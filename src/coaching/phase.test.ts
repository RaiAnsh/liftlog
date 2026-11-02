import { describe, expect, it } from 'vitest'
import { buildExercise } from '../db/exercises'
import { progressLabel, progressPct } from '../lib/progress'
import type { Exercise, Routine, SkipEntry, Workout, WorkoutSet } from '../types'
import { STYLE_RANGE, suggestStyle, targetsFor, goalPreset } from './goals'
import { exerciseAdvice, programReview } from './hypertrophy'
import { buildPlan, DAY_SHORT, nextPlanned, planToday, weekStrip } from './plan'
import { cardioStats, recommend, trainingStreak } from './recommend'
import { nextTarget } from './targets'
import { emptyCounts } from './volume'

const DAY = 86_400_000
const now = new Date(2026, 10, 4, 12).getTime() // Wednesday 4 Nov 2026 (JS getDay() === 3)
const fmt = (kg: number) => `${Math.round(kg * 100) / 100} kg`
let ord = 0
const ws = (w: number, ex: number, kg: number, reps: number, p: Partial<WorkoutSet> = {}): WorkoutSet => ({ workoutId: w, exerciseId: ex, order: ord++, type: 'working', weightKg: kg, reps, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p })
const wk = (id: number, daysAgo: number, name = 'W'): Workout => ({ id, routineId: null, name, startedAt: now - daysAgo * DAY, endedAt: null, notes: '', source: 'app' })
const routine = (id: number, name: string, order: number): Routine => ({ id, name, order, items: [] })

describe('volume styles', () => {
  it('efficient targets fit a 2-sets-per-exercise lifter; standard keeps the well-supported defaults', () => {
    expect(STYLE_RANGE.efficient.priority).toEqual({ min: 8, max: 14 })
    expect(STYLE_RANGE.standard.priority).toEqual({ min: 14, max: 22 })
    for (const t of ['priority', 'standard', 'light'] as const) {
      expect(STYLE_RANGE.efficient[t].max).toBeLessThan(STYLE_RANGE.standard[t].max)
      expect(STYLE_RANGE.standard[t].max).toBeLessThan(STYLE_RANGE.high[t].max)
    }
    const r = targetsFor(goalPreset('vtaper')!.tiers, 'efficient')
    expect(r.chest).toEqual({ min: 8, max: 14 })
    expect(r.quads).toEqual({ min: 3, max: 6 })
  })
  it('suggests efficient when you usually do about 2 sets per exercise, and needs enough history', () => {
    const workouts = Array.from({ length: 6 }, (_, i) => wk(i + 1, i + 1))
    const two = workouts.flatMap((w) => [ws(w.id!, 1, 50, 10), ws(w.id!, 1, 50, 10), ws(w.id!, 2, 40, 10), ws(w.id!, 2, 40, 10)])
    const three = workouts.flatMap((w) => [1, 2].flatMap((e) => [ws(w.id!, e, 50, 10), ws(w.id!, e, 50, 10), ws(w.id!, e, 50, 10)]))
    expect(suggestStyle(workouts, two)).toBe('efficient')
    expect(suggestStyle(workouts, three)).toBe('standard')
    expect(suggestStyle([wk(1, 1)], two.slice(0, 2))).toBeNull()
  })
})

describe('cutting', () => {
  const last = [ws(1, 1, 60, 12), ws(1, 1, 60, 12), ws(1, 1, 60, 12)]
  const o = { repMin: 8, repMax: 12, incrementKg: 2.5, fmt }
  it('without hold, hitting the top of the range raises the weight; on a cut the target is to match last time', () => {
    expect(nextTarget(last, o)!.kind).toBe('increase')
    const t = nextTarget(last, { ...o, hold: true })!
    expect(t.kind).toBe('hold')
    expect(t.sets.every((s) => s.weightKg === 60 && s.reps === 12)).toBe(true)
    expect(t.reason).toContain('Cutting: matching last time')
  })
  it('hold keeps each set as it was, even with mixed weights or reps below the top', () => {
    const t = nextTarget([ws(1, 1, 60, 10), ws(1, 1, 55, 9)], { ...o, hold: true })!
    expect(t.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 10], [55, 9]])
  })
  const ex: Exercise = { ...buildExercise('Chest Press (Machine)', 'lb'), id: 1 }
  it('never suggests adding sets while cutting', () => {
    const base = { exercise: ex, last: [ws(1, 1, 50, 10), ws(1, 1, 50, 10)], avgWeekly: { ...emptyCounts(), chest: 3 }, targets: { chest: { min: 14, max: 22 } } }
    expect(exerciseAdvice({ ...base, phase: 'build' })[0]?.kind).toBe('add-set')
    expect(exerciseAdvice({ ...base, phase: 'cut' }).map((a) => a.kind)).not.toContain('add-set')
  })
  it('the program review stops asking for more volume on a cut', () => {
    const e = new Map([[1, ex]])
    const workouts = [0, 1, 2, 3].map((w) => wk(w + 1, 7 * (w + 1)))
    const sets = workouts.flatMap((w) => [ws(w.id!, 1, 50, 10), ws(w.id!, 1, 50, 10)])
    const goal = { id: 'vtaper' as const, tiers: goalPreset('vtaper')!.tiers }
    const h = { sets, workouts, exercises: e, routines: [] }
    const args = { h, goal, targets: {}, now, startDay: 1 as const, candidates: [], limit: 50 }
    expect(programReview({ ...args, phase: 'build' })!.items.some((i) => i.kind === 'add')).toBe(true)
    expect(programReview({ ...args, phase: 'cut' })!.items.some((i) => i.kind === 'add')).toBe(false)
  })
})

describe('% vs last time', () => {
  it('compares best estimated 1RM, shows 0% when matched, negative when down', () => {
    expect(progressPct([{ weightKg: 60, reps: 10 }], [{ weightKg: 60, reps: 10 }])).toBe(0)
    expect(progressPct([{ weightKg: 60, reps: 10 }], [{ weightKg: 62.5, reps: 10 }])).toBe(4)
    expect(progressPct([{ weightKg: 60, reps: 10 }], [{ weightKg: 55, reps: 10 }])).toBe(-8)
    expect(progressPct([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }], [{ weightKg: 60, reps: 12 }])).toBe(5) // best set matters: 84 vs 80 estimated 1RM
  })
  it('falls back to volume for high reps and to reps for bodyweight, and is null without a baseline', () => {
    expect(progressPct([{ weightKg: 20, reps: 15 }], [{ weightKg: 20, reps: 18 }])).toBe(20)
    expect(progressPct([{ weightKg: 0, reps: 10 }, { weightKg: 0, reps: 8 }], [{ weightKg: 0, reps: 10 }, { weightKg: 0, reps: 10 }])).toBe(11)
    expect(progressPct(undefined, [{ weightKg: 60, reps: 10 }])).toBeNull()
    expect(progressPct([], [{ weightKg: 60, reps: 10 }])).toBeNull()
    expect(progressPct([{ weightKg: 60, reps: 10 }], [])).toBeNull()
  })
  it('labels it, and on a cut treats matching (and tiny dips) as fine', () => {
    expect(progressLabel(4)).toEqual({ text: '▲ 4% vs last time', tone: 'up' })
    expect(progressLabel(0).text).toBe('= 0% vs last time')
    expect(progressLabel(0, true)).toEqual({ text: '✓ matched last time', tone: 'same' })
    expect(progressLabel(-3, true).tone).toBe('same')
    expect(progressLabel(-12, true).tone).toBe('down')
    expect(progressLabel(-3).tone).toBe('down')
  })
})

describe('weekly plan', () => {
  const push = routine(1, 'Push', 0), pull = routine(2, 'Pull', 1), legs = routine(3, 'Legs', 2)
  const routines = [push, pull, legs]
  const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0
  it('assigns templates in rotation order to the free days, Monday first', () => {
    const p = buildPlan([WED, MON, FRI], routines)
    expect([p[MON], p[WED], p[FRI]]).toEqual([1, 2, 3])
    expect([p[TUE], p[THU], p[SAT], p[SUN]]).toEqual([null, null, null, null])
  })
  it('cycles when there are more days than templates, and uses the first few when there are fewer', () => {
    const five = buildPlan([MON, TUE, THU, FRI, SAT], routines)
    expect([five[MON], five[TUE], five[THU], five[FRI], five[SAT]]).toEqual([1, 2, 3, 1, 2])
    const two = buildPlan([TUE, THU], routines)
    expect([two[TUE], two[THU]]).toEqual([1, 2])
    expect(buildPlan([MON], []).every((x) => x === null)).toBe(true)
  })
  it('respects which templates are in your rotation', () => {
    expect(buildPlan([MON, TUE], routines, [2, 3]).filter(Boolean)).toEqual([2, 3])
  })
  const plan = buildPlan([MON, WED, FRI], routines) // now is Wednesday
  it('says what today is: planned, done, skipped or rest', () => {
    expect(planToday(plan, routines, [], [], now)).toMatchObject({ state: 'planned', label: 'Wednesday', routine: { name: 'Pull' } })
    expect(planToday(plan, routines, [wk(1, 0)], [], now)).toMatchObject({ state: 'done', next: { routine: { name: 'Legs' }, inDays: 2 } })
    const skip: SkipEntry = { id: 's', at: now, routineId: 2, name: 'Pull', reason: null }
    expect(planToday(plan, routines, [], [skip], now)!.state).toBe('skipped')
    const thursday = now + DAY
    expect(planToday(plan, routines, [], [], thursday)).toMatchObject({ state: 'rest', next: { routine: { name: 'Legs' }, inDays: 1 } })
    expect(planToday(null, routines, [], [], now)).toBeNull()
    expect(planToday(Array(7).fill(null), routines, [], [], now)).toBeNull()
  })
  it('finds the next planned day, wrapping into next week', () => {
    expect(nextPlanned(plan, routines, now)).toMatchObject({ dayIndex: FRI, inDays: 2 })
    expect(nextPlanned(plan, routines, now + 3 * DAY)).toMatchObject({ dayIndex: MON, inDays: 2 }) // from Saturday: Sunday, then Monday
  })
  it('builds the week strip with what happened on each day', () => {
    const monday = new Date(2026, 10, 2).getTime()
    const strip = weekStrip(plan, routines, [wk(1, 2)], [], monday, now)
    expect(strip.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(strip.map((d) => d.routine?.name ?? '-')).toEqual(['Push', '-', 'Pull', '-', 'Legs', '-', '-'])
    expect(strip[0]).toMatchObject({ done: true, past: true }) // Monday workout (2 days ago)
    expect(strip[2]).toMatchObject({ today: true, done: false })
    expect(DAY_SHORT[3]).toBe('Wed')
  })
})

describe('recommended for you', () => {
  const base = { phase: 'build' as const, cardio: { sessions: 2, minutes: 70 }, streakDays: 1, hasHistory: true }
  it('suggests easy cardio on a cut when you have done fewer than 2 sessions, with an action', () => {
    const r = recommend({ ...base, phase: 'cut', cardio: { sessions: 0, minutes: 0 } })
    expect(r[0]).toMatchObject({ id: 'cardio-cut', action: { kind: 'cardio', name: 'Incline Walk (Treadmill)' } })
    expect(r[0].detail).toContain('0 in the last 7 days')
    expect(recommend({ ...base, phase: 'cut', cardio: { sessions: 3, minutes: 90 } })).toEqual([])
  })
  it('recommends rest after a long streak, ahead of everything else', () => {
    const r = recommend({ ...base, phase: 'cut', streakDays: 5, cardio: { sessions: 0, minutes: 0 } })
    expect(r.map((x) => x.id)).toEqual(['rest', 'cardio-cut'])
  })
  it('points at the workout for your most under-trained priority muscle (not while cutting)', () => {
    const laggard = { routineId: 7, routineName: 'Push', muscleLabel: 'Side delts' }
    expect(recommend({ ...base, laggard })[0]).toMatchObject({ id: 'laggard', action: { kind: 'template', routineId: 7 } })
    expect(recommend({ ...base, phase: 'cut', laggard }).some((r) => r.id === 'laggard')).toBe(false)
  })
  it('adds a light cardio nudge for general health when you do very little, never more than two', () => {
    const r = recommend({ ...base, cardio: { sessions: 0, minutes: 10 } })
    expect(r[0].id).toBe('cardio-health')
    expect(recommend({ ...base, streakDays: 6, cardio: { sessions: 0, minutes: 0 }, laggard: { routineId: 1, routineName: 'Push', muscleLabel: 'Chest' } })).toHaveLength(2)
  })
  it('stays quiet with no history', () => expect(recommend({ ...base, hasHistory: false, phase: 'cut', cardio: { sessions: 0, minutes: 0 } })).toEqual([]))
})

describe('cardio stats and training streak', () => {
  const tm: Exercise = { ...buildExercise('Running (Treadmill)', 'lb'), id: 9 }
  const bench: Exercise = { ...buildExercise('Bench Press (Barbell)', 'lb'), id: 1 }
  it('counts cardio sessions and minutes in the last 7 days only', () => {
    const workouts = [wk(1, 1), wk(2, 3), wk(3, 20)]
    const sets = [ws(1, 9, 0, 0, { seconds: 1500 }), ws(2, 9, 0, 0, { seconds: 900 }), ws(2, 1, 60, 10), ws(3, 9, 0, 0, { seconds: 3000 })]
    expect(cardioStats({ sets, workouts, exercises: new Map([[9, tm], [1, bench]]) }, now)).toEqual({ sessions: 2, minutes: 40 })
  })
  it('counts consecutive training days back from today, or yesterday if you have not trained yet today', () => {
    expect(trainingStreak([wk(1, 0), wk(2, 1), wk(3, 2), wk(4, 4)], now)).toBe(3)
    expect(trainingStreak([wk(1, 1), wk(2, 2)], now)).toBe(2)
    expect(trainingStreak([wk(1, 3)], now)).toBe(0)
  })
})
