import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import { guessMuscles } from '../import/exerciseMap'
import type { Exercise, Muscle, Routine, Workout, WorkoutSet } from '../types'
import { applyFix } from './actions'
import { goalPreset } from './goals'
import { chooseFix, exerciseAdvice, programReview, THRESHOLDS, weeklyAverages, type Candidate } from './hypertrophy'
import { emptyCounts } from './volume'

const DAY = 86_400_000
const mon = new Date(2026, 2, 2).getTime() // a Monday
const now = mon + 4 * 7 * DAY + 2 * DAY // Wednesday, 4 weeks after `mon`

const ex = (id: number, name: string): Exercise => ({ ...buildExercise(name, 'lb'), id, needsReview: false })
const bench = ex(1, 'Chest Press (Machine)')
const lat = ex(2, 'Lat Pulldown (Cable)')
const lateral = ex(3, 'Lateral Raise (Dumbbell)')
const curl = ex(4, 'Bicep Curl (Dumbbell)')
const exMap = new Map([bench, lat, lateral, curl].map((e) => [e.id!, e]))

let ord = 0
const ws = (workoutId: number, exerciseId: number, weightKg: number, reps: number, p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  workoutId, exerciseId, order: ord++, type: 'working', weightKg, reps, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p,
})
const sets = (workoutId: number, exerciseId: number, n: number, reps = 10, p: Partial<WorkoutSet> = {}) => Array.from({ length: n }, () => ws(workoutId, exerciseId, 50, reps, p))
const wk = (id: number, week: number, dayOffset = 0, name = 'W'): Workout => ({ id, routineId: null, name, startedAt: mon + week * 7 * DAY + dayOffset * DAY + 10 * 3600_000, endedAt: null, notes: '', source: 'app' })

describe('exerciseAdvice (next-time tips)', () => {
  const base = { avgWeekly: null, targets: {} }
  const adv = (last: WorkoutSet[], o: Partial<Parameters<typeof exerciseAdvice>[0]> = {}) => exerciseAdvice({ exercise: bench, last, ...base, ...o })

  it('flags sets that looked too easy when RPE was logged', () => {
    const a = adv(sets(1, 1, 3, 10, { rpe: 6 }))
    expect(a[0]).toMatchObject({ kind: 'effort', sci: 'effort' })
    expect(a[0].text).toContain('RPE 6.0')
  })
  it('stays quiet about effort when RPE is fine or missing', () => {
    expect(adv(sets(1, 1, 3, 10, { rpe: 8 }))).toEqual([])
    expect(adv(sets(1, 1, 3, 10))).toEqual([])
  })
  it('suggests more rest when reps collapse across sets at one weight', () => {
    const a = adv([ws(1, 1, 50, 12), ws(1, 1, 50, 9), ws(1, 1, 50, 7)])
    expect(a.map((x) => x.kind)).toContain('rest')
    expect(adv([ws(1, 1, 50, 12), ws(1, 1, 50, 11), ws(1, 1, 50, 10)]).map((x) => x.kind)).not.toContain('rest')
  })
  it('flags very high or very low reps for growth', () => {
    expect(adv(sets(1, 1, 3, 25)).find((x) => x.kind === 'load')!.text).toContain('heavier')
    expect(adv(sets(1, 1, 3, 2)).find((x) => x.kind === 'load')!.text).toContain('lighter')
    expect(adv(sets(1, 1, 3, 15))).toEqual([])
  })
  it('does not call bodyweight high reps "too light"', () => {
    expect(adv(sets(1, 1, 3, 25).map((s) => ({ ...s, weightKg: 0 })))).toEqual([])
  })

  it('adds a set when the muscle averages well below the weekly goal and the last session was productive', () => {
    const avgWeekly = { ...emptyCounts(), chest: 5 }
    const a = adv(sets(1, 1, 3, 10), { avgWeekly })
    expect(a[0]).toMatchObject({ kind: 'add-set', sci: 'volume' })
    expect(a[0].text).toContain('5 sets a week')
  })
  it('does not add a set if reps were below the exercise rep range or it already has 5 sets', () => {
    const avgWeekly = { ...emptyCounts(), chest: 5 }
    expect(adv(sets(1, 1, 3, 5), { avgWeekly }).map((x) => x.kind)).not.toContain('add-set')
    expect(adv(sets(1, 1, 5, 10), { avgWeekly }).map((x) => x.kind)).not.toContain('add-set')
  })
  it('trims a set when the muscle is well above the weekly maximum', () => {
    const avgWeekly = { ...emptyCounts(), chest: 30 }
    expect(adv(sets(1, 1, 4, 10), { avgWeekly })[0]).toMatchObject({ kind: 'trim-set' })
    expect(adv(sets(1, 1, 3, 10), { avgWeekly })).toEqual([]) // only trims where there is a set to spare
  })
  it('uses the goal-driven range, not a fixed one', () => {
    const avgWeekly = { ...emptyCounts(), chest: 8 }
    expect(adv(sets(1, 1, 3, 10), { avgWeekly, targets: { chest: { min: 14, max: 22 } } })[0].kind).toBe('add-set')
    expect(adv(sets(1, 1, 3, 10), { avgWeekly, targets: { chest: { min: 5, max: 9 } } })).toEqual([])
  })
  it('warns when you stack too many sets for one muscle into a single session', () => {
    const a = adv([], { plannedToday: THRESHOLDS.sessionCap + 2 })
    expect(a[0]).toMatchObject({ kind: 'split', sci: 'session' })
    expect(adv([], { plannedToday: THRESHOLDS.sessionCap })).toEqual([])
  })
  it('returns at most two tips, most important first', () => {
    const a = adv([ws(1, 1, 50, 12, { rpe: 6 }), ws(1, 1, 50, 9, { rpe: 6 }), ws(1, 1, 50, 7, { rpe: 6 })], { avgWeekly: { ...emptyCounts(), chest: 4 }, plannedToday: 14 })
    expect(a).toHaveLength(2)
    expect(a.map((x) => x.kind)).toEqual(['effort', 'rest'])
  })
})

describe('weeklyAverages (learns from your last training weeks, skipping gaps)', () => {
  it('averages the most recent complete weeks that had training, ignoring empty weeks and the current week', () => {
    // weeks 0, 1 and 3 trained; week 2 empty (holiday); current week is week 4
    const workouts = [wk(1, 0), wk(2, 1), wk(3, 3), wk(4, 4)]
    const all = [...sets(1, 1, 6), ...sets(2, 1, 9), ...sets(3, 1, 12), ...sets(4, 1, 50)]
    const wa = weeklyAverages({ sets: all, workouts, exercises: exMap, routines: [] }, now, 1)!
    expect(wa.weekStarts).toHaveLength(3)
    expect(wa.avg.chest).toBeCloseTo((6 + 9 + 12) / 3)
    expect(wa.avg.chest).not.toBeCloseTo(18) // the 50 sets this week are excluded
  })
  it('counts separate sessions per week for each muscle', () => {
    const workouts = [wk(1, 0, 0), wk(2, 0, 3), wk(3, 1, 1)]
    const all = [...sets(1, 1, 3), ...sets(2, 1, 3), ...sets(3, 1, 3)]
    const wa = weeklyAverages({ sets: all, workouts, exercises: exMap, routines: [] }, now, 1)!
    expect(wa.sessions.chest).toBeCloseTo((2 + 1) / 2)
  })
  it('needs at least two training weeks', () => {
    expect(weeklyAverages({ sets: sets(1, 1, 5), workouts: [wk(1, 0)], exercises: exMap, routines: [] }, now, 1)).toBeNull()
  })
})

describe('programReview (suggests changes to your templates)', () => {
  const item = (exerciseId: number, targetSets = 3) => ({ exerciseId, targetSets, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' })
  const push: Routine = { id: 10, name: 'Push', order: 0, items: [item(1)] }
  const pull: Routine = { id: 11, name: 'Pull', order: 1, items: [item(2), item(4)] }
  const cands: Candidate[] = [
    { key: 'lateral raise (dumbbell)', name: 'Lateral Raise (Dumbbell)', muscles: ['side_delts'], mine: true, sets: 400 },
    { key: 'lateral raise (cable)', name: 'Lateral Raise (Cable)', muscles: ['side_delts'], mine: true, sets: 20 },
    { key: 'lat pulldown (cable)', name: 'Lat Pulldown (Cable)', muscles: ['upper_back_lats'], mine: true, sets: 300 },
    { key: 'chest press (machine)', name: 'Chest Press (Machine)', muscles: ['chest'], mine: true, sets: 300 },
  ]
  // 4 weeks of Push + Pull once a week: chest 12 sets in one session, lats 3, side delts 0, biceps ~1.5.
  const workouts = [0, 1, 2, 3].flatMap((w) => [wk(w * 2 + 1, w, 0, 'Push'), wk(w * 2 + 2, w, 2, 'Pull')])
  const all = [0, 1, 2, 3].flatMap((w) => [...sets(w * 2 + 1, 1, 12), ...sets(w * 2 + 2, 2, 3)])
  const h = { sets: all, workouts, exercises: exMap, routines: [push, pull] }
  const vtaper = { id: 'vtaper' as const, tiers: goalPreset('vtaper')!.tiers }

  it('flags an under-served priority muscle, with a concrete fix on the matching template', () => {
    const r = programReview({ h, goal: vtaper, targets: {}, now, startDay: 1, candidates: cands })!
    const side = r.items.find((i) => i.muscle === 'side_delts')!
    expect(side).toMatchObject({ kind: 'add', tier: 'priority' })
    expect(side.detail).toContain('0 sets a week')
    expect(side.fix).toMatchObject({ routineName: 'Push', exerciseName: 'Lateral Raise (Dumbbell)' }) // Push owns shoulders; your most-used raise wins
    expect(side.fix!.sets).toBeGreaterThanOrEqual(2)
    expect(r.weeks).toBe(4)
  })
  it('lists priority muscles first', () => {
    const r = programReview({ h, goal: vtaper, targets: {}, now, startDay: 1, candidates: cands })!
    const tiers = r.items.map((i) => i.tier)
    expect(tiers.indexOf('priority')).toBe(0)
    expect(tiers.lastIndexOf('priority')).toBeLessThan(tiers.indexOf('standard') === -1 ? 99 : tiers.indexOf('standard') + 99)
  })
  it('does not nag about maintain-level muscles being low (that is the point of the goal)', () => {
    const r = programReview({ h, goal: vtaper, targets: {}, now, startDay: 1, candidates: cands })!
    expect(r.items.find((i) => i.muscle === 'quads')).toBeUndefined()
  })
  it('does not ask for more of a muscle that already meets its goal', () => {
    const r = programReview({ h, goal: vtaper, targets: { chest: { min: 10, max: 20 } }, now, startDay: 1, candidates: cands, limit: 50 })!
    expect(r.items.find((i) => i.muscle === 'chest' && i.kind === 'add')).toBeUndefined() // 12 sets a week meets a 10 minimum
  })
  it('suggests spreading a high-volume muscle that is only ever trained in one session', () => {
    const r = programReview({ h, goal: vtaper, targets: { chest: { min: 8, max: 20 } }, now, startDay: 1, candidates: cands, limit: 50 })!
    expect(r.items.find((i) => i.muscle === 'chest')).toMatchObject({ kind: 'frequency', fix: null })
  })
  it('suggests trimming a maintain-level muscle that gets far more than it needs', () => {
    const heavyArms = [...all, ...[0, 1, 2, 3].flatMap((w) => sets(w * 2 + 2, 4, 6))] // 6 extra biceps sets/week + 3 lat secondary
    const glutesGoal = { id: 'glutes' as const, tiers: goalPreset('glutes')!.tiers } // biceps = maintain (5-9)
    const r = programReview({ h: { ...h, sets: heavyArms }, goal: glutesGoal, targets: { biceps: { min: 3, max: 4 } }, now, startDay: 1, candidates: cands, limit: 50 })!
    expect(r.items.find((i) => i.muscle === 'biceps')).toMatchObject({ kind: 'trim' })
  })
  it('works with no goal chosen (treats every muscle as standard)', () => {
    const r = programReview({ h, goal: null, targets: {}, now, startDay: 1, candidates: cands })!
    expect(r.items.length).toBeGreaterThan(0)
    expect(r.items.every((i) => i.tier === null)).toBe(true)
  })
  it('says nothing until there are at least two training weeks to learn from', () => {
    expect(programReview({ h: { ...h, workouts: [workouts[0]], sets: sets(1, 1, 4) }, goal: vtaper, targets: {}, now, startDay: 1, candidates: cands })).toBeNull()
  })

  it('chooseFix picks the group-matching template, skips exercises already in it, and prefers ones you use', () => {
    expect(chooseFix('side_delts', 6, h, cands)).toMatchObject({ routineName: 'Push', exerciseName: 'Lateral Raise (Dumbbell)', sets: 3 })
    const withRaise = { ...h, routines: [{ ...push, items: [...push.items, item(3)] }, pull] }
    expect(chooseFix('side_delts', 6, withRaise, cands)).toMatchObject({ exerciseName: 'Lateral Raise (Cable)' })
    expect(chooseFix('upper_back_lats', 4, h, cands.filter((c) => c.key !== 'lat pulldown (cable)'))).toBeNull() // nothing suitable to add
    expect(chooseFix('chest', 4, { ...h, routines: [] }, cands)).toBeNull()
  })
})

describe('applyFix (one-tap edit of a template)', () => {
  let n = 0
  it('adds the exercise to the template, creating it if new, and never duplicates', async () => {
    const db = new LiftLogDB(`fix-${n++}`)
    const bench1 = ex(1, 'Chest Press (Machine)')
    bench1.id = await db.exercises.add(bench1)
    const rid = await db.routines.add({ name: 'Push', order: 0, items: [{ exerciseId: bench1.id!, targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' }] })
    const fix = { routineId: rid, routineName: 'Push', exerciseKey: 'lateral raise (dumbbell)', exerciseName: 'Lateral Raise (Dumbbell)', sets: 3 }

    expect(await applyFix(fix, 'lb', db)).toBe(true)
    const r = (await db.routines.get(rid))!
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toMatchObject({ targetSets: 3, restSeconds: 90 })
    const created = await db.exercises.where('nameKey').equals('lateral raise (dumbbell)').first()
    expect(created?.primaryMuscles).toEqual(guessMuscles('Lateral Raise (Dumbbell)').primary)
    expect(r.items[1].exerciseId).toBe(created!.id)

    expect(await applyFix(fix, 'lb', db)).toBe(false) // already there
    expect((await db.routines.get(rid))!.items).toHaveLength(2)
    expect(await applyFix({ ...fix, routineId: 999 }, 'lb', db)).toBe(false) // template was deleted
  })
})

// keep the Muscle import used for typing helpers above
export type _M = Muscle

import { plannedSetsFor } from './hypertrophy'
import { draftExercise, emptyDraft } from '../workout/draft'
describe('plannedSetsFor', () => {
  it('counts primary sets as 1 and secondary as 0.5, ignoring warm-ups', () => {
    const d = emptyDraft(0)
    d.exercises.push(draftExercise(bench, { restSeconds: 90, sets: 4 }), draftExercise(lat, { restSeconds: 90, sets: 3 }))
    d.exercises[0].sets[0].type = 'warmup'
    expect(plannedSetsFor(d, exMap, 'chest')).toBe(3)
    expect(plannedSetsFor(d, exMap, 'triceps')).toBe(1.5) // chest press: triceps secondary, 3 working sets
    expect(plannedSetsFor(d, exMap, 'quads')).toBe(0)
  })
})
