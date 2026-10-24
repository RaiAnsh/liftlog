import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from '../types'
import { inRange, records, sessionPoints } from './exerciseStats'
import { livePR, prTimeline } from './prs'
import { platesFor, smallestStep } from './plates'
import { warmupSets } from './warmup'
import { addWarmups, draftExercise, emptyDraft } from '../workout/draft'
import { buildExercise } from '../db/exercises'

const DAY = 86_400_000
const wk = (id: number, day: number): Workout => ({ id, routineId: null, name: `W${id}`, startedAt: day * DAY, endedAt: null, notes: '', source: 'app' })
let o = 0
const st = (workoutId: number, weightKg: number, reps: number, p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  workoutId, exerciseId: 1, order: o++, type: 'working', weightKg, reps, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p,
})

describe('session points and records', () => {
  const workouts = [wk(1, 1), wk(2, 8), wk(3, 15)]
  const sets = [
    st(1, 50, 10), st(1, 50, 8), st(1, 20, 10, { type: 'warmup' }),
    st(2, 55, 8), st(2, 55, 6),
    st(3, 50, 12), st(3, 60, 3),
  ]
  const pts = sessionPoints(sets, workouts)

  it('summarises each session, excluding warm-ups, oldest first', () => {
    expect(pts.map((p) => p.workoutId)).toEqual([1, 2, 3])
    expect(pts[0]).toMatchObject({ topWeightKg: 50, volumeKg: 50 * 10 + 50 * 8 })
    expect(pts[0].e1rmKg).toBeCloseTo(50 * (1 + 10 / 30))
    expect(pts[2].topWeightKg).toBe(60)
  })
  it('only counts e1RM for sets of 12 reps or fewer', () => {
    const p = sessionPoints([st(1, 40, 15)], [wk(1, 1)])
    expect(p[0].e1rmKg).toBe(0)
    expect(p[0].topWeightKg).toBe(40)
  })
  it('finds heaviest, best e1RM, best volume and best reps per weight', () => {
    const r = records(pts)
    expect(r.heaviest).toMatchObject({ weightKg: 60, reps: 3 })
    expect(r.bestE1rm?.weightKg).toBe(50) // 50x12 -> 70 beats 55x8 -> 69.67 and 60x3 -> 66
    expect(r.bestVolume).toMatchObject({ volumeKg: 900 })
    expect(r.repsAtWeight.map((x) => [x.weightKg, x.reps])).toEqual([[60, 3], [55, 8], [50, 12]])
  })
  it('filters by range', () => {
    expect(inRange(pts, '3M', 16 * DAY)).toHaveLength(3)
    expect(inRange(pts, '3M', 200 * DAY)).toHaveLength(0)
    expect(inRange(pts, 'All', 9999 * DAY)).toHaveLength(3)
  })
})

describe('PR timeline', () => {
  it('skips the baseline session and records later improvements', () => {
    const starts = new Map([[1, 1], [2, 2], [3, 3], [4, 4]])
    const ev = prTimeline([st(1, 50, 8), st(2, 50, 8), st(3, 55, 8), st(4, 50, 10, { type: 'warmup' })], starts)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ workoutId: 3, weightKg: 55, kind: 'e1rm' })
  })
})

describe('live PR check', () => {
  const bests = { weightKg: 60, e1rmKg: 70 }
  it('detects new e1RM and weight records, including earlier sets this session', () => {
    expect(livePR(bests, [], 60, 10)).toBe('e1rm')
    expect(livePR(bests, [], 65, 1)).toBe('weight')
    expect(livePR(bests, [], 60, 5)).toBeNull() // e1RM exactly 70: tie is not a record
    expect(livePR(bests, [{ weightKg: 60, reps: 10 }], 60, 10)).toBeNull()
  })
  it('never fires without history or without weight', () => {
    expect(livePR(undefined, [], 100, 5)).toBeNull()
    expect(livePR(bests, [], 0, 20)).toBeNull()
  })
})

describe('plate calculator', () => {
  const lb = [45, 35, 25, 10, 5, 2.5]
  const per = (r: ReturnType<typeof platesFor>) => r.perSide.map((x) => `${x.count}x${x.plate}`)
  it('loads simple weights', () => {
    expect(per(platesFor(225, 45, lb))).toEqual(['2x45'])
    expect(per(platesFor(135, 45, lb))).toEqual(['1x45'])
    expect(platesFor(135, 45, lb).diff).toBe(0)
    expect(per(platesFor(100, 45, lb))).toEqual(['1x25', '1x2.5'])
  })
  it('uses the fewest plates', () => {
    expect(per(platesFor(315, 45, lb))).toEqual(['3x45'])
  })
  it('beats greedy on awkward inventories', () => {
    // 50 per side with only 45s and 25s: greedy takes 45 and gets stuck; 2x25 is exact.
    const r = platesFor(145, 45, [45, 25])
    expect(per(r)).toEqual(['2x25'])
    expect(r.diff).toBe(0)
  })
  it('falls back to the closest lighter load', () => {
    const r = platesFor(137, 45, lb)
    expect(r.achieved).toBe(135)
    expect(r.diff).toBe(-2)
  })
  it('handles bar-only and kg fractions', () => {
    expect(platesFor(40, 45, lb)).toEqual({ perSide: [], achieved: 45, diff: 5 })
    const kg = platesFor(62.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25])
    expect(kg.achieved).toBe(62.5)
    expect(per(kg)).toEqual(['1x20', '1x1.25'])
  })
  it('reports the smallest weight step', () => {
    expect(smallestStep(lb)).toBe(5)
  })
})

describe('warm-up generator', () => {
  it('ramps bar x10, 40/60/80% for a barbell lift', () => {
    const w = warmupSets({ workingKg: 100, barKg: 20, stepKg: 2.5, useBar: true })
    expect(w).toEqual([{ weightKg: 20, reps: 10 }, { weightKg: 40, reps: 5 }, { weightKg: 60, reps: 3 }, { weightKg: 80, reps: 1 }])
  })
  it('skips the bar for machines', () => {
    const w = warmupSets({ workingKg: 100, barKg: 20, stepKg: 5, useBar: false })
    expect(w.map((x) => x.weightKg)).toEqual([40, 60, 80])
  })
  it('drops sets that collapse onto the bar or each other at light weights', () => {
    const w = warmupSets({ workingKg: 30, barKg: 20, stepKg: 2.5, useBar: true })
    expect(w.map((x) => x.weightKg)).toEqual([20, 25])
    for (let i = 1; i < w.length; i++) expect(w[i].weightKg).toBeGreaterThan(w[i - 1].weightKg)
  })
  it('returns nothing without a working weight or when the weight is only the bar', () => {
    expect(warmupSets({ workingKg: 0, barKg: 20, stepKg: 2.5, useBar: true })).toEqual([])
    expect(warmupSets({ workingKg: 20, barKg: 20, stepKg: 2.5, useBar: true })).toEqual([])
  })
  it('prepends warm-up sets to a draft exercise without touching working sets', () => {
    const d = emptyDraft(0)
    d.exercises.push(draftExercise({ ...buildExercise('Bench Press (Barbell)', 'lb'), id: 1 }, { restSeconds: 90, sets: 2 }))
    const r = addWarmups(d, d.exercises[0].uid, [{ weightKg: 20, reps: 10 }, { weightKg: 40, reps: 5 }])
    expect(r.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'warmup', 'working', 'working'])
    expect(r.exercises[0].sets[1]).toMatchObject({ weightKg: 40, reps: 5, completed: false })
  })
})

import { formatEstimate } from '../units'
describe('estimate formatting', () => {
  it('rounds to one decimal', () => {
    expect(formatEstimate(66.67 * 0.45359237, 'lb')).toBe('66.7')
    expect(formatEstimate(100, 'kg')).toBe('100')
  })
})
