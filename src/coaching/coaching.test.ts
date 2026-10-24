import { describe, expect, it } from 'vitest'
import { sessionPoints } from '../lib/exerciseStats'
import type { Exercise, Muscle, Routine, Workout, WorkoutSet } from '../types'
import { buildExercise } from '../db/exercises'
import { fatigueSignal } from './fatigue'
import { detectPlateau, similarExercises } from './plateau'
import { lateWeekWarning, matchRoutine, nextInRotation, rotationOf, skipWarning, staleMuscles, suggestNext } from './suggest'
import { weeklySummary } from './summary'
import { metTarget, nextTarget, targetForSet } from './targets'
import { addDays, countMuscleSets, daysIntoWeek, emptyCounts, statusOf, weekStartOf, weeklyBreakdown } from './volume'

const DAY = 86_400_000
const fmt = (kg: number) => `${Math.round(kg * 100) / 100} kg`
const base = { repMin: 8, repMax: 12, incrementKg: 2.5, fmt }
let ord = 0
const ws = (weightKg: number, reps: number, p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  workoutId: 1, exerciseId: 1, order: ord++, type: 'working', weightKg, reps, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p,
})

describe('next-session targets (double progression)', () => {
  it('adds weight and resets reps when every set hit the top at the same weight', () => {
    const t = nextTarget([ws(60, 12), ws(60, 12), ws(60, 12)], base)!
    expect(t.kind).toBe('increase')
    expect(t.sets).toEqual([{ weightKg: 62.5, reps: 8 }, { weightKg: 62.5, reps: 8 }, { weightKg: 62.5, reps: 8 }])
    expect(t.reason).toBe('You hit 12/12/12 last time → +2.5 kg')
  })
  it('keeps weight and adds a rep only on sets below the top, capped at the max', () => {
    const t = nextTarget([ws(60, 12), ws(60, 10), ws(60, 9)], base)!
    expect(t.kind).toBe('reps')
    expect(t.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 12], [60, 11], [60, 10]])
    expect(t.reason).toContain('60 kg × 12/10/9')
  })
  it('does not raise weight when average RPE is 9.5+, even with all reps hit', () => {
    const t = nextTarget([ws(60, 12, { rpe: 10 }), ws(60, 12, { rpe: 9.5 }), ws(60, 12, { rpe: 9.5 })], base)!
    expect(t.kind).toBe('hold')
    expect(t.sets.every((s) => s.weightKg === 60 && s.reps === 12)).toBe(true)
    expect(t.reason).toMatch(/RPE averaged 9\.7/)
  })
  it('still increases when RPE is below the threshold or missing', () => {
    expect(nextTarget([ws(60, 12, { rpe: 8 }), ws(60, 12, { rpe: 9 })], base)!.kind).toBe('increase')
    expect(nextTarget([ws(60, 12, { rpe: 9.4 }), ws(60, 12)], base)!.kind).toBe('increase')
  })
  it('does not call mixed weights "the same weight"', () => {
    const t = nextTarget([ws(60, 12), ws(55, 12)], base)!
    expect(t.kind).toBe('reps')
    expect(t.sets.map((s) => s.weightKg)).toEqual([60, 55])
  })
  it('ignores warm-ups and drop sets, counts failure sets as working', () => {
    const t = nextTarget([ws(20, 10, { type: 'warmup' }), ws(60, 12), ws(60, 12, { type: 'failure' }), ws(40, 15, { type: 'drop' })], base)!
    expect(t.kind).toBe('increase')
    expect(t.sets).toHaveLength(2)
  })
  it('handles bodyweight and no history', () => {
    expect(nextTarget([ws(0, 12), ws(0, 12)], base)!.kind).toBe('bodyweight')
    expect(nextTarget([], base)).toBeNull()
    expect(nextTarget(undefined, base)).toBeNull()
    expect(nextTarget([ws(60, 8, { completed: false })], base)).toBeNull()
  })
  it('deload takes ~10% off, rounded to the increment', () => {
    const t = nextTarget([ws(100, 10), ws(100, 9)], { ...base, deload: true })!
    expect(t.kind).toBe('deload')
    expect(t.sets.map((s) => s.weightKg)).toEqual([90, 90])
    expect(t.reason).toContain('10% lighter')
  })
  it('maps targets to sets, skipping warm-ups and reusing the last target for extras', () => {
    const t = nextTarget([ws(60, 10), ws(60, 9)], base)!
    const sets = [{ type: 'warmup' }, { type: 'working' }, { type: 'working' }, { type: 'working' }]
    expect(targetForSet(t, sets, 0)).toBeNull()
    expect(targetForSet(t, sets, 1)).toEqual({ weightKg: 60, reps: 11 })
    expect(targetForSet(t, sets, 3)).toEqual({ weightKg: 60, reps: 10 })
  })
  it('detects hitting or beating the target', () => {
    const tg = { weightKg: 60, reps: 10 }
    expect(metTarget({ weightKg: 60, reps: 10 }, tg)).toBe(true)
    expect(metTarget({ weightKg: 62.5, reps: 8 }, tg)).toBe(false)
    expect(metTarget({ weightKg: 65, reps: 11 }, tg)).toBe(true)
    expect(metTarget({ weightKg: null, reps: 10 }, tg)).toBe(false)
  })
})

// A Monday-start week: Mon 2026-03-02 .. Sun 2026-03-08
const mon = new Date(2026, 2, 2).getTime()
const ex = (id: number, name: string, primary: Muscle[], secondary: Muscle[] = []): Exercise => ({ ...buildExercise(name, 'kg'), id, primaryMuscles: primary, secondaryMuscles: secondary, needsReview: false })
const bench = ex(1, 'Bench', ['chest'], ['triceps', 'front_delts'])
const row = ex(2, 'Row', ['upper_back_lats'], ['biceps'])
const squat = ex(3, 'Squat', ['quads'], ['glutes', 'hamstrings'])
const curl = ex(4, 'Leg Curl', ['hamstrings'])
const exMap = new Map([bench, row, squat, curl].map((e) => [e.id!, e]))
const wk = (id: number, day: number, name = 'Push', routineId: number | null = null): Workout => ({ id, routineId, name, startedAt: mon + day * DAY + 10 * 3600_000, endedAt: null, notes: '', source: 'app' })
const set = (workoutId: number, exerciseId: number, n: number, p: Partial<WorkoutSet> = {}): WorkoutSet[] =>
  Array.from({ length: n }, () => ws(50, 10, { workoutId, exerciseId, ...p }))

describe('weekly muscle volume', () => {
  const workouts = [wk(1, 0), wk(2, 2, 'Pull'), wk(3, -3, 'Old')]
  const sets = [
    ...set(1, 1, 4), ...set(1, 1, 2, { type: 'warmup' }), // 4 bench hard sets, warm-ups ignored
    ...set(2, 2, 3), ...set(2, 1, 1, { completed: false }), // unfinished set ignored
    ...set(3, 3, 5), // previous week
  ]
  it('counts primary as 1 and secondary as 0.5, excluding warm-ups and unfinished sets', () => {
    const c = countMuscleSets(sets, workouts, exMap, mon, addDays(mon, 7))
    expect(c.chest).toBe(4)
    expect(c.triceps).toBe(2)
    expect(c.front_delts).toBe(2)
    expect(c.upper_back_lats).toBe(3)
    expect(c.biceps).toBe(1.5)
    expect(c.quads).toBe(0)
  })
  it('breaks down the last 4 weeks, oldest first', () => {
    const b = weeklyBreakdown(sets, workouts, exMap, mon + 3 * DAY, 1, 4)
    expect(b).toHaveLength(4)
    expect(b[3].weekStart).toBe(mon)
    expect(b[3].counts.chest).toBe(4)
    expect(b[2].counts.quads).toBe(5)
    expect(b[2].counts.glutes).toBe(2.5)
  })
  it('classifies under / in / over against a range', () => {
    const r = { min: 10, max: 20 }
    expect([statusOf(9.5, r), statusOf(10, r), statusOf(20, r), statusOf(20.5, r)]).toEqual(['under', 'in', 'in', 'over'])
  })
  it('finds week starts for Monday and Sunday weeks', () => {
    const wed = new Date(2026, 2, 4, 15).getTime()
    expect(weekStartOf(wed, 1)).toBe(mon)
    expect(weekStartOf(wed, 0)).toBe(new Date(2026, 2, 1).getTime())
    expect(weekStartOf(new Date(2026, 2, 8, 23).getTime(), 1)).toBe(mon) // Sunday night, across a US clock change
    expect(daysIntoWeek(wed, 1)).toBe(2)
    expect(daysIntoWeek(new Date(2026, 2, 8).getTime(), 1)).toBe(6)
  })
})

describe('next workout suggestion and warnings', () => {
  const item = (exerciseId: number, targetSets = 3) => ({ exerciseId, targetSets, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' })
  const push: Routine = { id: 1, name: 'Push', order: 0, items: [item(1)] }
  const pull: Routine = { id: 2, name: 'Pull', order: 1, items: [item(2)] }
  const legs: Routine = { id: 3, name: 'Legs', order: 2, items: [item(3, 4), item(4, 4)] }
  const routines = [push, pull, legs]
  const targets = {}

  it('matches workouts to routines by id, then by name', () => {
    expect(matchRoutine(wk(1, 0, 'x', 2), routines)?.name).toBe('Pull')
    expect(matchRoutine(wk(1, 0, ' push '), routines)?.name).toBe('Push')
    expect(matchRoutine(wk(1, 0, 'Chest2'), routines)).toBeNull()
  })
  it('rotates to the next routine, wraps, and respects the program and skips', () => {
    const rot = rotationOf(routines, [])
    expect(nextInRotation(rot, [], routines, null)?.routine.name).toBe('Push')
    expect(nextInRotation(rot, [wk(1, 0, 'Push')], routines, null)?.routine.name).toBe('Pull')
    expect(nextInRotation(rot, [wk(1, 0, 'Push'), wk(2, 1, 'Legs')], routines, null)?.routine.name).toBe('Push')
    expect(nextInRotation(rot, [wk(1, 0, 'Push')], routines, { routineId: 2, at: mon + 2 * DAY })?.routine.name).toBe('Legs')
    expect(nextInRotation(rot, [wk(1, 5, 'Push')], routines, { routineId: 2, at: mon })?.routine.name).toBe('Pull')
    expect(rotationOf(routines, [1, 3]).map((r) => r.name)).toEqual(['Push', 'Legs'])
  })
  it('suggests the rotation routine, with an alternative only when it clearly fixes a bigger deficit', () => {
    const counts = emptyCounts()
    counts.chest = 12; counts.triceps = 10; counts.front_delts = 10; counts.upper_back_lats = 10; counts.biceps = 10
    const s = suggestNext({ routines, program: [], workouts: [wk(1, 0, 'Pull')], lastSkip: null, counts, targets, exercises: exMap })
    expect(s?.routine.name).toBe('Legs') // rotation says Legs after Pull
    const behind = { ...counts }
    const s2 = suggestNext({ routines, program: [], workouts: [wk(1, 0, 'Push')], lastSkip: null, counts: behind, targets, exercises: exMap })
    expect(s2?.routine.name).toBe('Pull')
    expect(s2?.alternative?.routine.name).toBe('Legs')
    expect(s2?.alternative?.reason).toMatch(/Legs would add ~\d+ sets toward .*quads/)
  })
  it('does not offer an alternative when the gain is small', () => {
    const counts = emptyCounts()
    for (const m of ['chest', 'triceps', 'front_delts', 'quads', 'hamstrings', 'glutes', 'upper_back_lats', 'biceps'] as Muscle[]) counts[m] = 10
    counts.upper_back_lats = 8
    const s = suggestNext({ routines, program: [], workouts: [wk(1, 0, 'Push')], lastSkip: null, counts, targets, exercises: exMap })
    expect(s?.alternative).toBeNull()
  })
  it('warns with numbers when skipping would leave a muscle under target', () => {
    const counts = emptyCounts()
    counts.hamstrings = 4; counts.quads = 12
    const w = skipWarning(legs, counts, targets, exMap)!
    expect(w.text).toBe('Skipping Legs leaves hamstrings at just 4 sets this week (10+ sets is a good week).')
    expect(w.risk.map((r) => r.muscle)).toEqual(['hamstrings'])
    counts.hamstrings = 10
    expect(skipWarning(legs, counts, targets, exMap)).toBeNull()
  })
  it('joins several at-risk muscles and honours custom targets', () => {
    const counts = emptyCounts()
    counts.hamstrings = 4; counts.quads = 6
    expect(skipWarning(legs, counts, {}, exMap)!.text).toBe('Skipping Legs leaves hamstrings at just 4 sets and quads at just 6 sets this week (10+ sets is a good week).')
    expect(skipWarning(legs, counts, { hamstrings: { min: 3, max: 8 } }, exMap)!.text).toBe('Skipping Legs leaves quads at just 6 sets this week (10+ sets is a good week).')
  })
  it('flags under-target muscles late in the week only', () => {
    const counts = Object.fromEntries(Object.keys(emptyCounts()).map((m) => [m, 12])) as ReturnType<typeof emptyCounts>
    counts.hamstrings = 4; counts.quads = 0
    expect(lateWeekWarning(counts, targets, mon + 2 * DAY, 1)).toBeNull() // Wednesday
    const late = lateWeekWarning(counts, { quads: { min: 0, max: 0 } }, mon + 4 * DAY + 3600_000, 1)! // Friday
    expect(late.muscles).toEqual([{ muscle: 'hamstrings', current: 4, min: 10 }])
    expect(late.text).toBe('It’s Friday: hamstrings (4 sets) is still building this week.')
    expect(late.text).not.toContain('quads')
  })
  it('flags muscles untouched for 8+ days, but not stale-forever ones', () => {
    const now = mon + 20 * DAY
    const workouts2 = [wk(1, 11, 'Push'), wk(2, 18, 'Pull'), wk(3, -200, 'Ancient')]
    const sets2 = [...set(1, 1, 3), ...set(2, 2, 3), ...set(3, 3, 3)]
    const stale = staleMuscles(sets2, workouts2, exMap, {}, now)
    const names = stale.map((s) => s.muscle)
    expect(names).toContain('chest')
    expect(stale.find((s) => s.muscle === 'chest')!.days).toBe(8)
    expect(names).not.toContain('upper_back_lats') // trained 2 days ago
    expect(names).not.toContain('quads') // 200 days ago: dropped on purpose
  })
})

describe('plateau detection', () => {
  const pts = (rows: [number, number][]) =>
    sessionPoints(rows.flatMap(([w, r], i) => set(i + 1, 1, 1, { weightKg: w, reps: r })), rows.map((_, i) => wk(i + 1, i * 3)))
  const now = mon + 30 * DAY
  it('flags three sessions without a weight or e1RM gain', () => {
    expect(detectPlateau(pts([[60, 10], [60, 10], [60, 10]]), now)).not.toBeNull()
    expect(detectPlateau(pts([[60, 10], [60, 9], [57.5, 10]]), now)).not.toBeNull()
  })
  it('does not flag when reps or weight improve', () => {
    expect(detectPlateau(pts([[60, 10], [60, 10], [60, 11]]), now)).toBeNull() // e1RM up
    expect(detectPlateau(pts([[60, 10], [62.5, 8], [60, 8]]), now)).toBeNull() // weight up in session 2
  })
  it('needs three sessions, recent activity and a loaded lift', () => {
    expect(detectPlateau(pts([[60, 10], [60, 10]]), now)).toBeNull()
    expect(detectPlateau(pts([[60, 10], [60, 10], [60, 10]]), mon + 200 * DAY)).toBeNull()
    expect(detectPlateau(pts([[0, 10], [0, 10], [0, 10]]), now)).toBeNull()
  })
  it('suggests similar exercises by primary muscle, most used first', () => {
    const alt = ex(5, 'Incline', ['chest'])
    const alt2 = ex(6, 'Fly', ['chest'])
    const r = similarExercises(bench, [bench, alt, alt2, row], new Map([[6, 9], [5, 2]]))
    expect(r.map((e) => e.name)).toEqual(['Fly', 'Incline'])
  })
})

describe('fatigue signal', () => {
  const now = mon + 30 * DAY
  const day = (n: number) => now - n * DAY
  const w = (id: number, ago: number): Workout => ({ ...wk(id, 0), startedAt: day(ago) })
  const s = (workoutId: number, exerciseId: number, weightKg: number, reps: number, rpe: number | null) => ws(weightKg, reps, { workoutId, exerciseId, rpe })

  it('fires when the same weight x reps feels 1+ RPE harder on two or more lifts', () => {
    const workouts = [w(1, 14), w(2, 2)]
    const sets = [s(1, 1, 60, 8, 7), s(1, 2, 50, 10, 7.5), s(2, 1, 60, 8, 8.5), s(2, 2, 50, 10, 8.5)]
    const hits = fatigueSignal(sets, workouts, now)!
    expect(hits.map((h) => h.exerciseId).sort()).toEqual([1, 2])
  })
  it('needs more than one lift, a full RPE point, and RPE data', () => {
    const workouts = [w(1, 14), w(2, 2)]
    expect(fatigueSignal([s(1, 1, 60, 8, 7), s(2, 1, 60, 8, 9)], workouts, now)).toBeNull()
    expect(fatigueSignal([s(1, 1, 60, 8, 7), s(1, 2, 50, 10, 7), s(2, 1, 60, 8, 7.5), s(2, 2, 50, 10, 7.5)], workouts, now)).toBeNull()
    expect(fatigueSignal([s(1, 1, 60, 8, null), s(1, 2, 50, 10, null), s(2, 1, 60, 8, null), s(2, 2, 50, 10, null)], workouts, now)).toBeNull()
  })
  it('only compares against sessions about two weeks back', () => {
    const workouts = [w(1, 6), w(2, 2)]
    const sets = [s(1, 1, 60, 8, 7), s(1, 2, 50, 10, 7), s(2, 1, 60, 8, 9), s(2, 2, 50, 10, 9)]
    expect(fatigueSignal(sets, workouts, now)).toBeNull()
  })
})

describe('weekly summary', () => {
  it('summarises sessions, sets, volume status, PRs and stalled lifts', () => {
    const workouts = [wk(1, -7, 'Push'), wk(2, 0, 'Push'), wk(3, 2, 'Push'), wk(4, 4, 'Push'), wk(5, 5, 'Push')]
    const sets = [
      ...set(1, 1, 3, { weightKg: 50 }), // last week baseline
      ...set(2, 1, 3, { weightKg: 50 }),
      ...set(3, 1, 3, { weightKg: 50 }),
      ...set(4, 1, 3, { weightKg: 50 }),
      ...set(5, 1, 4, { weightKg: 60, reps: 8 }), // PR in this week
    ]
    const h = { sets, workouts, exercises: exMap, routines: [] }
    const sum = weeklySummary(h, mon, {}, mon + 6 * DAY)
    expect(sum.sessions).toBe(4)
    expect(sum.hardSets).toBe(13)
    expect(sum.prs).toBe(1)
    expect(sum.inRange).toContain('chest')
    expect(sum.under.map((u) => u.muscle)).toContain('quads')
  })
})

import { computeHighlights, lastTrained } from './highlights'
import { levelOf, weeklyTotals } from './volume'
import { lastRotationSkip, newSkip, removeSkip, skipsBetween } from './skips'

describe('plain-language levels', () => {
  it('maps counts to words instead of x/10', () => {
    const r = { min: 10, max: 20 }
    expect([levelOf(0, r), levelOf(4, r), levelOf(10, r), levelOf(20, r), levelOf(21, r)]).toEqual(['none', 'low', 'good', 'good', 'high'])
  })
})

describe('weekly totals', () => {
  it('counts workouts, hard sets and volume per week, oldest first', () => {
    const workouts = [wk(1, 0), wk(2, 2), wk(3, -3)]
    const sets = [...set(1, 1, 3, { weightKg: 10, reps: 10 }), ...set(1, 1, 2, { type: 'warmup' }), ...set(2, 1, 2, { weightKg: 20, reps: 5 }), ...set(3, 1, 4, { weightKg: 10, reps: 10 })]
    const t = weeklyTotals(sets, workouts, mon + 3 * DAY, 1, 3)
    expect(t).toHaveLength(3)
    expect(t[2]).toMatchObject({ weekStart: mon, workouts: 2, sets: 5, volumeKg: 3 * 100 + 2 * 100 })
    expect(t[1]).toMatchObject({ workouts: 1, sets: 4, volumeKg: 400 })
    expect(t[0].workouts).toBe(0)
  })
})

describe('skip log', () => {
  it('finds the latest routine skip, ignores skips without a routine, and can undo one', () => {
    const a = newSkip('Push', 1, 'Tired', 100)
    const b = newSkip('Pull', 2, null, 200)
    const c = newSkip('Rest', null, null, 300)
    expect(lastRotationSkip([a, b, c])).toEqual({ routineId: 2, at: 200 })
    expect(lastRotationSkip([])).toBeNull()
    expect(removeSkip([a, b, c], b.id).map((s) => s.name)).toEqual(['Push', 'Rest'])
    expect(skipsBetween([a, b, c], 150, 350)).toHaveLength(2)
  })
  it('a skip moves the rotation on', () => {
    const push: Routine = { id: 1, name: 'Push', order: 0, items: [] }
    const pull: Routine = { id: 2, name: 'Pull', order: 1, items: [] }
    const skip = lastRotationSkip([newSkip('Push', 1, null, mon + DAY)])
    expect(nextInRotation([push, pull], [], [push, pull], skip)?.routine.name).toBe('Pull')
  })
})

describe('highlights (best / improve / lift)', () => {
  const now = mon + 4 * DAY
  const mkWeeks = (cur: Partial<Record<Muscle, number>>, prev: Partial<Record<Muscle, number>> = {}) => {
    const w = (c: Partial<Record<Muscle, number>>, i: number) => ({ weekStart: mon + (i - 3) * 7 * DAY, counts: { ...emptyCounts(), ...c } })
    return [w({}, 0), w({}, 1), w(prev, 2), w(cur, 3)]
  }

  it('names the strongest muscle relative to its target, with your usual for context', () => {
    const breakdown = mkWeeks({ chest: 12, biceps: 8, quads: 4 })
    breakdown[1].counts.chest = 6; breakdown[2].counts.chest = 6
    const h = computeHighlights({ breakdown, sets: [], workouts: [], exercises: exMap, targets: {}, now })
    expect(h.best).toMatchObject({ muscle: 'chest' })
    expect(h.best!.detail).toBe('12 sets this week, your usual is 4')
    expect(h.periodLabel).toBe('this week')
  })
  it('falls back to last week early in the week when little is logged', () => {
    const breakdown = mkWeeks({ chest: 1 }, { biceps: 12, chest: 3 })
    const h = computeHighlights({ breakdown, sets: [], workouts: [], exercises: exMap, targets: {}, now })
    expect(h.periodLabel).toBe('last week')
    expect(h.best?.muscle).toBe('biceps')
  })
  it('picks the longest-untrained muscle that is under target, and skips ones dropped long ago', () => {
    const workouts = [wk(1, -40, 'Old'), wk(2, -3, 'Recent'), wk(3, -300, 'Ancient')]
    const sets = [...set(1, 1, 3), ...set(2, 2, 3), ...set(3, 3, 3)]
    const breakdown = mkWeeks({ upper_back_lats: 10 })
    const h = computeHighlights({ breakdown, sets, workouts, exercises: exMap, targets: {}, now })
    expect(h.improve?.muscle).toBe('chest')
    expect(h.improve?.detail).toMatch(/Not trained in \d+ days/)
    expect(lastTrained(sets, workouts, exMap).has('quads')).toBe(true)
  })
  it('finds the lift whose estimated 1RM rose most in 8 weeks, and ignores tiny or stale changes', () => {
    const workouts = [wk(1, -30, 'a'), wk(2, -2, 'b'), wk(3, -29, 'c'), wk(4, -1, 'd')]
    const sets = [
      ...set(1, 1, 1, { weightKg: 50, reps: 10 }), ...set(2, 1, 1, { weightKg: 60, reps: 10 }), // +20%
      ...set(3, 2, 1, { weightKg: 50, reps: 10 }), ...set(4, 2, 1, { weightKg: 50.5, reps: 10 }), // +1%: ignored
    ]
    const h = computeHighlights({ breakdown: mkWeeks({}), sets, workouts, exercises: exMap, targets: {}, now })
    expect(h.lift?.exerciseId).toBe(1)
    expect(Math.round(h.lift!.pct * 100)).toBe(20)
    const none = computeHighlights({ breakdown: mkWeeks({}), sets: sets.slice(2), workouts, exercises: exMap, targets: {}, now })
    expect(none.lift).toBeNull()
  })
})

describe('plain-language warnings', () => {
  const item = (exerciseId: number, targetSets = 3) => ({ exerciseId, targetSets, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' })
  const push: Routine = { id: 1, name: 'Push', order: 0, items: [item(1)] }
  it('says "no sets" instead of 0/10, and singular for one set', () => {
    const counts = emptyCounts()
    expect(skipWarning(push, counts, {}, exMap)!.text).toBe('Skipping Push leaves chest with no sets this week (10+ sets is a good week).')
    counts.chest = 1
    expect(skipWarning(push, counts, {}, exMap)!.text).toBe('Skipping Push leaves chest at just 1 set this week (10+ sets is a good week).')
  })
  it('late-week text separates untouched muscles from ones still building, with no x/10', () => {
    const all = Object.fromEntries(Object.keys(emptyCounts()).map((m) => [m, 12])) as ReturnType<typeof emptyCounts>
    all.chest = 0; all.hamstrings = 1; all.quads = 6
    const w = lateWeekWarning(all, {}, mon + 4 * DAY + 3600_000, 1)!
    expect(w.text).toBe('It’s Friday: chest hasn’t been trained yet; quads (6 sets) and hamstrings (1 set) are still building this week.'.replace('quads (6 sets) and hamstrings (1 set)', 'hamstrings (1 set) and quads (6 sets)'))
    expect(w.text).not.toMatch(/\d+\/\d+/)
  })
})
