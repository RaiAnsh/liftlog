import { db as defaultDb, type LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import type { Unit } from '../types'
import type { Fix } from './hypertrophy'

/** Applies a coach suggestion: adds the exercise to the template (creating the exercise if it's new to you). */
export async function applyFix(fix: Fix, unit: Unit, d: LiftLogDB = defaultDb): Promise<boolean> {
  return d.transaction('rw', d.exercises, d.routines, async () => {
    const routine = await d.routines.get(fix.routineId)
    if (!routine) return false
    let ex = await d.exercises.where('nameKey').equals(fix.exerciseKey).first()
    if (!ex) { ex = buildExercise(fix.exerciseName, unit); ex.id = await d.exercises.add(ex) }
    if (routine.items.some((i) => i.exerciseId === ex!.id)) return false // already there: never duplicate
    await d.routines.update(routine.id!, {
      items: [...routine.items, { exerciseId: ex.id!, targetSets: fix.sets, repRangeMin: ex.repRangeMin, repRangeMax: ex.repRangeMax, restSeconds: 90, notes: '' }],
    })
    return true
  })
}
