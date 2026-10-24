import { toKg } from '../units'
import { guessEquipment, guessMuscles } from '../import/exerciseMap'
import type { Equipment, Exercise, Unit } from '../types'

export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

export function defaultIncrement(equipment: Equipment, unit: Unit): number {
  const inUnit = equipment === 'dumbbell' ? (unit === 'lb' ? 2.5 : 1) : unit === 'lb' ? 5 : 2.5
  return toKg(inUnit, unit)
}

/** Builds a new Exercise with muscles guessed from its name; flagged for review when unrecognised. */
export function buildExercise(name: string, unit: Unit, isCustom = false): Exercise {
  const guess = guessMuscles(name)
  const equipment = guessEquipment(name)
  return {
    name: name.trim(), nameKey: nameKey(name), equipment,
    primaryMuscles: guess.primary, secondaryMuscles: guess.secondary,
    weightIncrement: defaultIncrement(equipment, unit),
    repRangeMin: 8, repRangeMax: 12, isCustom, archived: false, needsReview: !guess.known,
  }
}
