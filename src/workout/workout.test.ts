import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import { detectPRs } from '../lib/prs'
import type { Exercise, Routine, WorkoutSet } from '../types'
import {
  addSet, adjustRest, draftToRows, emptyDraft, previousFor, removeExercise, startFromRoutine, toggleComplete,
  toggleSuperset, updateSet, draftExercise, timeOfDayName,
} from './draft'
import { getPreviousSets } from './previous'
import { saveWorkout } from './save'

let n = 0
const freshDb = () => new LiftLogDB(`w-${n++}`)
const ex = (id: number, name: string): Exercise => ({ ...buildExercise(name, 'lb'), id })
const bench = ex(1, 'Bench Press (Barbell)'), row = ex(2, 'Seated Row (Cable)'), curl = ex(3, 'Bicep Curl (Dumbbell)')
const exMap = new Map([bench, row, curl].map((e) => [e.id!, e]))
const ps = (o: Partial<WorkoutSet>): WorkoutSet => ({ workoutId: 9, exerciseId: 1, order: 0, type: 'working', weightKg: 60, reps: 8, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...o })

describe('starting a workout', () => {
  it('builds draft sets, rest and rep range from a routine', () => {
    const r: Routine = { id: 5, name: 'Push', order: 0, items: [
      { exerciseId: 1, targetSets: 4, repRangeMin: 6, repRangeMax: 10, restSeconds: 150, notes: 'slow' },
      { exerciseId: 99, targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' },
    ] }
    const d = startFromRoutine(r, exMap, 1000)
    expect(d.name).toBe('Push')
    expect(d.routineId).toBe(5)
    expect(d.exercises).toHaveLength(1)
    expect(d.exercises[0]).toMatchObject({ restSeconds: 150, repMin: 6, repMax: 10, notes: 'slow' })
    expect(d.exercises[0].sets).toHaveLength(4)
    expect(d.exercises[0].sets.every((s) => !s.completed && s.reps === null)).toBe(true)
  })
  it('names empty workouts by time of day', () => {
    expect(timeOfDayName(new Date(2026, 0, 1, 8).getTime())).toBe('Morning Workout')
    expect(timeOfDayName(new Date(2026, 0, 1, 20).getTime())).toBe('Evening Workout')
  })
})

describe('completing sets', () => {
  const base = () => { const d = emptyDraft(0); d.exercises.push(draftExercise(bench, { restSeconds: 120, sets: 3 })); return d }

  it('fills blanks from the previous session and starts the rest timer', () => {
    const d = base()
    const e = d.exercises[0]
    const prev = [ps({ weightKg: 60, reps: 8 }), ps({ weightKg: 60, reps: 7 })]
    const r = toggleComplete(d, e.uid, e.sets[1].uid, prev, 10_000)
    expect(r.exercises[0].sets[1]).toMatchObject({ completed: true, reps: 7, weightKg: 60 })
    expect(r.rest).toMatchObject({ endsAt: 130_000, total: 120, alerted: false })
  })
  it('prefers the target over previous values when filling blanks', () => {
    const d = base()
    const e = d.exercises[0]
    const target = { kind: 'reps' as const, reason: '', sets: [{ weightKg: 62.5, reps: 9 }] }
    const r = toggleComplete(d, e.uid, e.sets[0].uid, [ps({ weightKg: 60, reps: 8 })], 0, target)
    expect(r.exercises[0].sets[0]).toMatchObject({ weightKg: 62.5, reps: 9, completed: true })
  })
  it('does nothing when there are no reps and nothing to fill from', () => {
    const d = base()
    expect(toggleComplete(d, d.exercises[0].uid, d.exercises[0].sets[0].uid, undefined, 1)).toBe(d)
  })
  it('keeps typed values over previous ones, and uncompleting leaves the timer alone', () => {
    let d = base()
    const e = d.exercises[0]
    d = updateSet(d, e.uid, e.sets[0].uid, { weightKg: 70, reps: 5 })
    d = toggleComplete(d, e.uid, e.sets[0].uid, [ps({})], 0)
    expect(d.exercises[0].sets[0]).toMatchObject({ weightKg: 70, reps: 5, completed: true })
    const rest = d.rest
    d = toggleComplete(d, e.uid, e.sets[0].uid, [ps({})], 5)
    expect(d.exercises[0].sets[0].completed).toBe(false)
    expect(d.rest).toBe(rest)
  })
  it('aligns previous warm-up and working sets separately', () => {
    const d = base()
    const sets = [{ ...d.exercises[0].sets[0], type: 'warmup' as const }, d.exercises[0].sets[1], d.exercises[0].sets[2]]
    const prev = [ps({ type: 'warmup', reps: 10 }), ps({ reps: 8 }), ps({ reps: 6 })]
    expect(previousFor(prev, sets, 0)?.reps).toBe(10)
    expect(previousFor(prev, sets, 1)?.reps).toBe(8)
    expect(previousFor(prev, sets, 2)?.reps).toBe(6)
  })
  it('add-set copies the last weight but stays uncompleted', () => {
    let d = base()
    d = updateSet(d, d.exercises[0].uid, d.exercises[0].sets[2].uid, { weightKg: 80 })
    d = addSet(d, d.exercises[0].uid)
    const s = d.exercises[0].sets[3]
    expect(s).toMatchObject({ weightKg: 80, completed: false, reps: null })
  })
})

describe('rest timer', () => {
  it('adjusts from timestamps, never below now', () => {
    let d = emptyDraft(0)
    d.rest = { endsAt: 100_000, total: 90, label: '', alerted: true }
    expect(adjustRest(d, 15, 50_000).rest?.endsAt).toBe(115_000)
    expect(adjustRest(d, -15, 50_000).rest?.endsAt).toBe(85_000)
    expect(adjustRest(d, -120, 50_000).rest?.endsAt).toBe(50_000)
    expect(adjustRest(d, 15, 50_000).rest?.alerted).toBe(false)
  })
})

describe('supersets', () => {
  const three = () => { const d = emptyDraft(0); for (const e of [bench, row, curl]) d.exercises.push(draftExercise(e, { restSeconds: 60 })); return d }
  it('pairs with the next exercise and dissolves lone groups', () => {
    const t = three()
    let d = toggleSuperset(t, t.exercises[0].uid)
    expect(d.exercises.map((e) => e.superset)).toEqual([1, 1, null])
    d = toggleSuperset(d, d.exercises[0].uid)
    expect(d.exercises.map((e) => e.superset)).toEqual([null, null, null])
    d = toggleSuperset(t, t.exercises[0].uid)
    d = removeExercise(d, d.exercises[1].uid)
    expect(d.exercises.map((e) => e.superset)).toEqual([null, null])
  })
})

describe('saving a workout', () => {
  it('stores only completed sets with order, superset and note', async () => {
    const db = freshDb()
    await db.exercises.bulkAdd([bench, row])
    let d = emptyDraft(1000, 'Push')
    d.exercises.push({ ...draftExercise(bench, { restSeconds: 60, sets: 3 }), notes: 'felt strong' }, draftExercise(row, { restSeconds: 60, sets: 2 }))
    d = toggleSuperset(d, d.exercises[0].uid)
    d = updateSet(d, d.exercises[0].uid, d.exercises[0].sets[0].uid, { weightKg: 60, reps: 8, completed: true })
    d = updateSet(d, d.exercises[0].uid, d.exercises[0].sets[1].uid, { weightKg: 60, reps: 7, completed: true })
    d = updateSet(d, d.exercises[1].uid, d.exercises[1].sets[0].uid, { weightKg: 40, reps: 10, completed: true })
    const id = await saveWorkout(d, 61_000, db)
    const w = await db.workouts.get(id!)
    expect(w).toMatchObject({ name: 'Push', source: 'app', startedAt: 1000, endedAt: 61_000 })
    const sets = await db.sets.where('workoutId').equals(id!).sortBy('order')
    expect(sets).toHaveLength(3)
    expect(sets.map((s) => s.order)).toEqual([0, 1, 2])
    expect(sets[0]).toMatchObject({ notes: 'felt strong', supersetGroup: 1, completed: true })
    expect(sets[1].notes).toBe('')
  })
  it('saves nothing for an empty workout', async () => {
    const db = freshDb()
    expect(await saveWorkout(emptyDraft(0), 1, db)).toBeNull()
    expect(await db.workouts.count()).toBe(0)
    expect(draftToRows(emptyDraft(0), 1).sets).toHaveLength(0)
  })
})

describe('previous sets lookup', () => {
  it('returns the most recent session for each exercise', async () => {
    const db = freshDb()
    const old = await db.workouts.add({ routineId: null, name: 'a', startedAt: 100, endedAt: null, notes: '', source: 'app' })
    const recent = await db.workouts.add({ routineId: null, name: 'b', startedAt: 200, endedAt: null, notes: '', source: 'app' })
    await db.sets.bulkAdd([ps({ workoutId: old, reps: 5 }), ps({ workoutId: recent, reps: 9, order: 0 }), ps({ workoutId: recent, reps: 8, order: 1 })])
    const m = await getPreviousSets([1, 2], db)
    expect(m.get(1)?.map((s) => s.reps)).toEqual([9, 8])
    expect(m.has(2)).toBe(false)
  })
})

describe('PR detection', () => {
  it('flags heavier weights and better e1RM, ignoring first sessions and warm-ups', () => {
    const prior = [ps({ weightKg: 60, reps: 8 })]
    expect(detectPRs([ps({ weightKg: 62.5, reps: 8 })], prior)).toEqual([{ exerciseId: 1, weightKg: 62.5, e1rmKg: expect.any(Number) }])
    expect(detectPRs([ps({ weightKg: 60, reps: 10 })], prior)[0]).toMatchObject({ e1rmKg: expect.any(Number) })
    expect(detectPRs([ps({ weightKg: 60, reps: 8 })], prior)).toEqual([])
    expect(detectPRs([ps({ weightKg: 100, reps: 5 })], [])).toEqual([])
    expect(detectPRs([ps({ weightKg: 100, reps: 5, type: 'warmup' })], prior)).toEqual([])
  })
})

describe('db migration v3', () => {
  it('re-tags Strict Military Press only when it still has the old wrong tag', async () => {
    const name = `mig-${n++}`
    const old = new Dexie(name)
    old.version(1).stores({ exercises: '++id, &nameKey', routines: '++id, order', workouts: '++id, startedAt, routineId, &importKey', sets: '++id, workoutId, exerciseId, [exerciseId+workoutId], &importKey', settings: 'key' })
    old.version(2).stores({ active: 'key' })
    await old.table('exercises').bulkAdd([
      { ...buildExercise('Strict Military Press (Barbell)', 'lb'), primaryMuscles: ['triceps'], secondaryMuscles: [] },
      { ...buildExercise('Strict Military Press (Barbell) 2', 'lb'), primaryMuscles: ['triceps', 'chest'], secondaryMuscles: [] }, // manually edited
      { ...buildExercise('Bench Press (Barbell)', 'lb') },
    ])
    old.close()
    const db = new LiftLogDB(name)
    const list = await db.exercises.toArray()
    expect(list[0].primaryMuscles).toEqual(['front_delts'])
    expect(list[1].primaryMuscles).toEqual(['triceps', 'chest'])
    expect(list[2].primaryMuscles).toEqual(['chest'])
  })
})
