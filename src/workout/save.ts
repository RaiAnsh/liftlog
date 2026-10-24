import { db as defaultDb, type LiftLogDB } from '../db/db'
import type { ActiveWorkout } from '../types'
import { draftToRows } from './draft'

export async function saveWorkout(d: ActiveWorkout, now: number, database: LiftLogDB = defaultDb): Promise<number | null> {
  const { workout, sets } = draftToRows(d, now)
  if (!sets.length) return null
  return database.transaction('rw', database.workouts, database.sets, async () => {
    const workoutId = await database.workouts.add(workout)
    await database.sets.bulkAdd(sets.map((s) => ({ ...s, workoutId })))
    return workoutId
  })
}
