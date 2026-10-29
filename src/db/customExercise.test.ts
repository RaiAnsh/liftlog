import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { programReview, exerciseAdvice } from '../coaching/hypertrophy'
import { goalPreset } from '../coaching/goals'
import { countMuscleSets } from '../coaching/volume'
import { organize } from '../lib/exerciseGroups'
import { guessMuscles } from '../import/exerciseMap'
import { createBackup, parseBackup, restoreBackup } from '../backup/backup'
import type { Exercise, Routine, Workout, WorkoutSet } from '../types'
import { LiftLogDB } from './db'
import { archiveExercise, saveExercise } from './exercises'

let n = 0
const fresh = () => new LiftLogDB(`custom-${n++}`)

describe('creating your own exercise', () => {
  it('saves it with your muscle tags, marks it custom, and sensible defaults for its equipment', async () => {
    const db = fresh()
    const r = await saveExercise({ name: '  Cable   Pull Through Variation ', equipment: 'cable', primary: ['glutes'], secondary: ['hamstrings', 'glutes'] }, 'lb', db)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.exercise).toMatchObject({ name: 'Cable Pull Through Variation', nameKey: 'cable pull through variation', isCustom: true, needsReview: false, archived: false, equipment: 'cable' })
    expect(r.exercise.primaryMuscles).toEqual(['glutes'])
    expect(r.exercise.secondaryMuscles).toEqual(['hamstrings']) // a muscle can't be both main and extra
    expect(r.exercise.weightIncrement).toBeCloseTo(5 * 0.45359237, 4)
    expect((await db.exercises.toArray())).toHaveLength(1)
  })
  it('uses dumbbell-sized weight steps for dumbbell exercises, and kg steps in kg', async () => {
    const db = fresh()
    const a = await saveExercise({ name: 'Weird Curl', equipment: 'dumbbell', primary: ['biceps'], secondary: [] }, 'lb', db)
    const b = await saveExercise({ name: 'Weird Press', equipment: 'barbell', primary: ['chest'], secondary: [] }, 'kg', db)
    expect(a.ok && a.exercise.weightIncrement).toBeCloseTo(2.5 * 0.45359237, 4)
    expect(b.ok && b.exercise.weightIncrement).toBe(2.5)
  })
  it('rejects empty names, duplicates (any case/spacing), and nonsense combinations, without saving anything', async () => {
    const db = fresh()
    await saveExercise({ name: 'Hip Thrust (Barbell)', equipment: 'barbell', primary: ['glutes'], secondary: [] }, 'lb', db)
    expect(await saveExercise({ name: 'x', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db)).toMatchObject({ ok: false })
    expect(await saveExercise({ name: ' hip   THRUST (barbell) ', equipment: 'barbell', primary: ['glutes'], secondary: [] }, 'lb', db)).toMatchObject({ ok: false, error: expect.stringContaining('already have') })
    expect(await saveExercise({ name: 'Cardio Thing', equipment: 'other', primary: [], secondary: ['abs'] }, 'lb', db)).toMatchObject({ ok: false })
    expect(await db.exercises.count()).toBe(1)
  })
  it('allows a cardio exercise with no muscles', async () => {
    const r = await saveExercise({ name: 'Battle Ropes', equipment: 'other', primary: [], secondary: [] }, 'lb', fresh())
    expect(r.ok && r.exercise.primaryMuscles).toEqual([])
  })
})

describe('editing and removing', () => {
  it('lets you fix the muscles of ANY exercise (even imported ones) but only rename your own', async () => {
    const db = fresh()
    const built = (await saveExercise({ name: 'Mine', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db)) as { ok: true; exercise: Exercise }
    const imported: Exercise = { name: 'Slipine Press', nameKey: 'slipine press', equipment: 'other', primaryMuscles: ['chest'], secondaryMuscles: [], weightIncrement: 2, repRangeMin: 8, repRangeMax: 12, isCustom: false, archived: false, needsReview: true }
    imported.id = await db.exercises.add(imported)

    const a = await saveExercise({ name: 'Renamed', equipment: 'machine', primary: ['quads'], secondary: ['glutes'] }, 'lb', db, built.exercise.id)
    expect(a.ok && a.exercise).toMatchObject({ name: 'Renamed', nameKey: 'renamed', primaryMuscles: ['quads'], equipment: 'machine' })
    const b = await saveExercise({ name: 'Totally Different Name', equipment: 'machine', primary: ['chest', 'triceps'], secondary: [] }, 'lb', db, imported.id)
    expect(b.ok && b.exercise).toMatchObject({ name: 'Slipine Press', nameKey: 'slipine press', primaryMuscles: ['chest', 'triceps'], needsReview: false })
  })
  it('cannot rename onto another exercise\'s name', async () => {
    const db = fresh()
    await saveExercise({ name: 'One', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db)
    const two = (await saveExercise({ name: 'Two', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db)) as { ok: true; exercise: Exercise }
    expect(await saveExercise({ name: 'one', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db, two.exercise.id)).toMatchObject({ ok: false })
  })
  it('hides your own exercise but never deletes its history, and refuses to hide built-in ones', async () => {
    const db = fresh()
    const mine = (await saveExercise({ name: 'Mine', equipment: 'other', primary: ['abs'], secondary: [] }, 'lb', db)) as { ok: true; exercise: Exercise }
    const wid = await db.workouts.add({ routineId: null, name: 'W', startedAt: 1, endedAt: null, notes: '', source: 'app' })
    await db.sets.add({ workoutId: wid, exerciseId: mine.exercise.id!, order: 0, type: 'working', weightKg: 10, reps: 10, rpe: null, distance: 0, seconds: 0, notes: '', completed: true })
    expect(await archiveExercise(mine.exercise.id!, db)).toBe(true)
    expect((await db.exercises.get(mine.exercise.id!))!.archived).toBe(true)
    expect(await db.sets.count()).toBe(1)
    const lib = await db.exercises.add({ ...mine.exercise, id: undefined, name: 'Lib', nameKey: 'lib', isCustom: false })
    expect(await archiveExercise(lib, db)).toBe(false)
  })
})

describe('a custom exercise is a full citizen of the coaching', () => {
  const DAY = 86_400_000
  const mon = new Date(2026, 2, 2).getTime()
  const now = mon + 4 * 7 * DAY + 2 * DAY
  // The lifter's own "Cable Glute Squeeze": not in the library, tagged by them as glutes (+ hamstrings).
  const mine: Exercise = { id: 1, name: 'Cable Glute Squeeze', nameKey: 'cable glute squeeze', equipment: 'cable', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], weightIncrement: 2.27, repRangeMin: 8, repRangeMax: 12, isCustom: true, archived: false, needsReview: false }
  const press: Exercise = { ...mine, id: 2, name: 'Leg Press', nameKey: 'leg press', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings'], isCustom: false }
  const exMap = new Map([mine, press].map((e) => [e.id!, e]))
  const wk = (id: number, week: number): Workout => ({ id, routineId: null, name: 'Lower', startedAt: mon + week * 7 * DAY + 10 * 3600_000, endedAt: null, notes: '', source: 'app' })
  let o = 0
  const mk = (workoutId: number, exerciseId: number, k: number, p: Partial<WorkoutSet> = {}): WorkoutSet[] =>
    Array.from({ length: k }, () => ({ workoutId, exerciseId, order: o++, type: 'working', weightKg: 20, reps: 10, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p }))
  const workouts = [0, 1, 2, 3].map((w) => wk(w + 1, w))
  const sets = workouts.flatMap((w) => [...mk(w.id!, 1, 3), ...mk(w.id!, 2, 3)])
  const h = { sets, workouts, exercises: exMap, routines: [{ id: 5, name: 'Lower', order: 0, items: [{ exerciseId: 2, targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' }] } as Routine] }

  it('counts toward weekly muscle volume (primary 1, secondary 0.5)', () => {
    const c = countMuscleSets(sets, workouts, exMap, mon, mon + 7 * DAY)
    expect(c.glutes).toBe(3 + 3 * 0.5) // 3 squeezes (primary) + 3 leg-press sets (secondary)
    expect(c.hamstrings).toBe(3 * 0.5 + 3 * 0.5)
  })
  it('is filed under Legs > Glutes in the picker', () => {
    const items = [{ key: mine.nameKey, name: mine.name, muscles: mine.primaryMuscles, mine: true, lib: false, sets: 12 }]
    const [sec] = organize(items, {})
    expect(sec.group.id).toBe('legs')
    expect(sec.section.label).toBe('Glutes')
  })
  it('drives the coach: a priority muscle that is short gets a fix suggesting the lifter\'s own exercise', () => {
    const goal = { id: 'glutes' as const, tiers: goalPreset('glutes')!.tiers }
    const r = programReview({ h, goal, targets: {}, now, startDay: 1, limit: 50, candidates: [{ key: mine.nameKey, name: mine.name, muscles: mine.primaryMuscles, mine: true, sets: 12 }] })!
    const glutes = r.items.find((i) => i.muscle === 'glutes')!
    expect(glutes.kind).toBe('add')
    expect(glutes.fix).toMatchObject({ exerciseName: 'Cable Glute Squeeze', routineName: 'Lower' })
  })
  it('gets next-time tips based on the muscles the lifter chose', () => {
    const a = exerciseAdvice({ exercise: mine, last: mk(1, 1, 3), avgWeekly: { ...Object.fromEntries(['chest', 'glutes'].map((m) => [m, 0])) } as never, targets: { glutes: { min: 14, max: 22 } } })
    expect(a[0]).toMatchObject({ kind: 'add-set' })
    expect(a[0].text).toContain('glutes')
  })
  it('survives backup and restore like everything else', async () => {
    const a = fresh(), b = fresh()
    const r = await saveExercise({ name: 'My Own Move', equipment: 'cable', primary: ['side_delts'], secondary: ['traps'] }, 'lb', a)
    expect(r.ok).toBe(true)
    const parsed = parseBackup(JSON.stringify(await createBackup(a)))
    if (parsed.ok) await restoreBackup(parsed.file, b)
    expect((await b.exercises.toArray())[0]).toMatchObject({ name: 'My Own Move', isCustom: true, primaryMuscles: ['side_delts'], secondaryMuscles: ['traps'] })
  })
})

// A name the lifter types is auto-suggested muscles when it's recognisable (the form uses this).
describe('suggesting muscles from a typed name', () => {
  it('recognises common names and says nothing about unknown ones', () => {
    expect(guessMuscles('Hip Thrust (Smith Machine)').primary).toEqual(['glutes'])
    expect(guessMuscles('Zzz Mystery Move').known).toBe(false)
  })
})
