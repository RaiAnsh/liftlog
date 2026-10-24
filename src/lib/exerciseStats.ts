import type { Workout, WorkoutSet } from '../types'
import { e1rm, isHard } from './stats'

export interface SessionPoint {
  workoutId: number
  workoutName: string
  date: number
  topWeightKg: number
  e1rmKg: number
  volumeKg: number
  sets: WorkoutSet[]
}

/** One point per workout in which the exercise was done, oldest first. Warm-ups are excluded. */
export function sessionPoints(sets: WorkoutSet[], workouts: Workout[]): SessionPoint[] {
  const wk = new Map(workouts.map((w) => [w.id!, w]))
  const by = new Map<number, WorkoutSet[]>()
  for (const s of sets) {
    if (!isHard(s) || !wk.has(s.workoutId)) continue
    ;(by.get(s.workoutId) ?? by.set(s.workoutId, []).get(s.workoutId)!).push(s)
  }
  return [...by.entries()]
    .map(([id, list]) => ({
      workoutId: id, workoutName: wk.get(id)!.name, date: wk.get(id)!.startedAt,
      topWeightKg: list.reduce((m, s) => Math.max(m, s.weightKg), 0),
      e1rmKg: list.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps)), 0),
      volumeKg: list.reduce((n, s) => n + s.weightKg * s.reps, 0),
      sets: list.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.date - b.date)
}

export interface Records {
  heaviest: { weightKg: number; reps: number; date: number } | null
  bestE1rm: { e1rmKg: number; weightKg: number; reps: number; date: number } | null
  bestVolume: { volumeKg: number; date: number } | null
  /** best reps at each weight, heaviest weight first */
  repsAtWeight: { weightKg: number; reps: number; date: number }[]
}

const wKey = (kg: number) => Math.round(kg * 100) / 100

export function records(points: SessionPoint[]): Records {
  const out: Records = { heaviest: null, bestE1rm: null, bestVolume: null, repsAtWeight: [] }
  const reps = new Map<number, { weightKg: number; reps: number; date: number }>()
  for (const p of points) {
    if (p.volumeKg > (out.bestVolume?.volumeKg ?? 0)) out.bestVolume = { volumeKg: p.volumeKg, date: p.date }
    for (const s of p.sets) {
      if (s.weightKg <= 0) continue
      if (!out.heaviest || s.weightKg > out.heaviest.weightKg || (s.weightKg === out.heaviest.weightKg && s.reps > out.heaviest.reps)) {
        out.heaviest = { weightKg: s.weightKg, reps: s.reps, date: p.date }
      }
      const e = e1rm(s.weightKg, s.reps)
      if (e > (out.bestE1rm?.e1rmKg ?? 0)) out.bestE1rm = { e1rmKg: e, weightKg: s.weightKg, reps: s.reps, date: p.date }
      const k = wKey(s.weightKg)
      const cur = reps.get(k)
      if (!cur || s.reps > cur.reps) reps.set(k, { weightKg: s.weightKg, reps: s.reps, date: p.date })
    }
  }
  out.repsAtWeight = [...reps.values()].sort((a, b) => b.weightKg - a.weightKg)
  return out
}

export type Range = '3M' | '6M' | '1Y' | 'All'
const RANGE_DAYS: Record<Range, number> = { '3M': 91, '6M': 182, '1Y': 365, All: Infinity }

export function inRange<T extends { date: number }>(points: T[], range: Range, now = Date.now()): T[] {
  const cutoff = now - RANGE_DAYS[range] * 86_400_000
  return points.filter((p) => p.date >= cutoff)
}
