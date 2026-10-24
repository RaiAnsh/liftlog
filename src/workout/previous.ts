import { db as defaultDb, type LiftLogDB } from '../db/db'
import type { WorkoutSet } from '../types'
import type { Bests } from '../lib/prs'
import { e1rm, isHard } from '../lib/stats'

/** For each exercise, the sets from the most recent workout it appeared in (what "previous" shows). */
export async function getPreviousSets(exerciseIds: number[], database: LiftLogDB = defaultDb, beforeWorkoutId?: number) {
  const out = new Map<number, WorkoutSet[]>()
  for (const id of new Set(exerciseIds)) {
    const sets = (await database.sets.where('exerciseId').equals(id).toArray()).filter((s) => s.workoutId !== beforeWorkoutId)
    if (!sets.length) continue
    const wks = await database.workouts.where('id').anyOf([...new Set(sets.map((s) => s.workoutId))]).toArray()
    const latest = wks.reduce((a, b) => (b.startedAt > a.startedAt ? b : a))
    out.set(id, sets.filter((s) => s.workoutId === latest.id).sort((a, b) => a.order - b.order))
  }
  return out
}

/** All-time heaviest weight and best e1RM per exercise (warm-ups excluded), for live PR checks. */
export async function getBests(exerciseIds: number[], database: LiftLogDB = defaultDb) {
  const out = new Map<number, Bests>()
  for (const id of new Set(exerciseIds)) {
    const sets = (await database.sets.where('exerciseId').equals(id).toArray()).filter(isHard)
    if (!sets.length) continue
    out.set(id, {
      weightKg: sets.reduce((m, s) => Math.max(m, s.weightKg), 0),
      e1rmKg: sets.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps)), 0),
    })
  }
  return out
}
