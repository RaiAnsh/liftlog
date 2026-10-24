import type { Workout, WorkoutSet } from '../types'

export interface FatigueHit { exerciseId: number; weightKg: number; reps: number; rpeNow: number; rpeBefore: number }

const DAY = 86_400_000

/**
 * Only meaningful with RPE data. Looks at hard sets from the last 7 days and finds the same
 * weight x reps about two weeks earlier (11 to 17 days back). If it now feels >= 1 RPE harder on
 * at least two different lifts, suggest a lighter week.
 */
export function fatigueSignal(sets: WorkoutSet[], workouts: Workout[], now: number) {
  const start = new Map(workouts.map((w) => [w.id!, w.startedAt]))
  const withRpe = sets.filter((s) => s.completed && s.type !== 'warmup' && s.rpe !== null && s.weightKg > 0 && s.reps > 0 && start.has(s.workoutId))
  const recent = withRpe.filter((s) => now - start.get(s.workoutId)! <= 7 * DAY)
  const earlier = withRpe.filter((s) => { const age = now - start.get(s.workoutId)!; return age >= 11 * DAY && age <= 17 * DAY })

  const byEx = new Map<number, FatigueHit>()
  for (const r of recent) {
    const match = earlier.filter((e) => e.exerciseId === r.exerciseId && e.reps === r.reps && Math.abs(e.weightKg - r.weightKg) <= r.weightKg * 0.005)
    if (!match.length) continue
    const before = match.reduce((n, e) => n + e.rpe!, 0) / match.length
    if (r.rpe! - before >= 1 && (!byEx.has(r.exerciseId) || r.rpe! - before > byEx.get(r.exerciseId)!.rpeNow - byEx.get(r.exerciseId)!.rpeBefore)) {
      byEx.set(r.exerciseId, { exerciseId: r.exerciseId, weightKg: r.weightKg, reps: r.reps, rpeNow: r.rpe!, rpeBefore: before })
    }
  }
  const hits = [...byEx.values()]
  return hits.length >= 2 ? hits : null
}
