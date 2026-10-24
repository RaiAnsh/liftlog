import type { Exercise, Muscle, Settings, Workout, WorkoutSet } from '../types'
import { MUSCLES } from '../types'

export type MuscleCounts = Record<Muscle, number>
export type Status = 'under' | 'in' | 'over'
export interface Range { min: number; max: number }

export const DEFAULT_RANGE: Range = { min: 10, max: 20 }

export const emptyCounts = (): MuscleCounts => Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleCounts
export const rangeFor = (m: Muscle, targets: Settings['weeklyTargets']): Range => targets[m] ?? DEFAULT_RANGE

export const statusOf = (count: number, r: Range): Status => (count < r.min ? 'under' : count > r.max ? 'over' : 'in')

/** Local midnight at the start of the week containing ts (startDay 1 = Monday, 0 = Sunday). */
export function weekStartOf(ts: number, startDay: 0 | 1): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7))
  return d.getTime()
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 0 on the first day of the week, 6 on the last. */
export const daysIntoWeek = (ts: number, startDay: 0 | 1) => (new Date(ts).getDay() - startDay + 7) % 7

/**
 * Hard sets per muscle for workouts in [from, to): completed non-warm-up sets,
 * 1 per primary muscle and 0.5 per secondary muscle.
 */
export function countMuscleSets(
  sets: WorkoutSet[], workouts: Workout[], exercises: Map<number, Exercise>, from: number, to: number,
): MuscleCounts {
  const inRange = new Set(workouts.filter((w) => w.startedAt >= from && w.startedAt < to).map((w) => w.id!))
  const out = emptyCounts()
  for (const s of sets) {
    if (!s.completed || s.type === 'warmup' || !inRange.has(s.workoutId)) continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) out[m] += 1
    for (const m of ex.secondaryMuscles) out[m] += 0.5
  }
  return out
}

/** The last `weeks` weeks (oldest first, current week last). */
export function weeklyBreakdown(
  sets: WorkoutSet[], workouts: Workout[], exercises: Map<number, Exercise>, now: number, startDay: 0 | 1, weeks = 4,
): { weekStart: number; counts: MuscleCounts }[] {
  const current = weekStartOf(now, startDay)
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(current, -7 * (weeks - 1 - i))
    return { weekStart, counts: countMuscleSets(sets, workouts, exercises, weekStart, addDays(weekStart, 7)) }
  })
}

export const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
