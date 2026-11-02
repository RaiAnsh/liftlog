import { db as defaultDb, type LiftLogDB } from '../db/db'
import { buildExercise, nameKey } from '../db/exercises'
import type { Unit } from '../types'
import { draftExercise, emptyDraft } from './draft'
import { startDraft } from './store'

/** Starts a cardio workout with one exercise (e.g. an incline walk), creating the exercise if you don't have it yet. */
export async function startCardio(name: string, unit: Unit, d: LiftLogDB = defaultDb): Promise<void> {
  let ex = await d.exercises.where('nameKey').equals(nameKey(name)).first()
  if (!ex) { ex = buildExercise(name, unit); ex.id = await d.exercises.add(ex) }
  const draft = emptyDraft(Date.now(), 'Cardio')
  draft.exercises.push(draftExercise(ex, { restSeconds: 0 }))
  startDraft(draft)
}
