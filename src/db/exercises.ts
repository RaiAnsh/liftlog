import { toKg } from '../units'
import { guessEquipment, guessMuscles } from '../import/exerciseMap'
import { db as defaultDb, type LiftLogDB } from './db'
import type { Equipment, Exercise, Muscle, Unit } from '../types'

export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

/** Time/distance exercises (treadmill, bike...). Older rows have no flag, so fall back to "no muscles and not awaiting review". */
export const isCardio = (e: Pick<Exercise, 'cardio' | 'primaryMuscles' | 'needsReview'>) => e.cardio ?? (e.primaryMuscles.length === 0 && !e.needsReview)

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
    cardio: guess.known && guess.primary.length === 0,
  }
}

export interface ExerciseInput {
  name: string
  equipment: Equipment
  primary: Muscle[]
  secondary: Muscle[]
}

export type SaveResult = { ok: true; exercise: Exercise } | { ok: false; error: string }

/**
 * Creates (or, with `existingId`, edits) an exercise the lifter defines themselves: its name, equipment and which
 * muscles it works. Muscle tags are what weekly volume, goals, coach tips and Push/Pull/Legs filing all run on,
 * so a custom exercise is a full citizen. Imported/built-in exercises keep their name (history is keyed to it)
 * but their muscles and equipment can be corrected.
 */
export async function saveExercise(input: ExerciseInput, unit: Unit, d: LiftLogDB = defaultDb, existingId?: number): Promise<SaveResult> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { ok: false, error: 'Give it a name (at least 2 letters).' }
  const primary = [...new Set(input.primary)]
  const secondary = [...new Set(input.secondary)].filter((m) => !primary.includes(m))
  const cardio = primary.length === 0
  if (cardio && secondary.length) return { ok: false, error: 'Pick at least one main muscle, or clear the extras for a cardio exercise.' }

  return d.transaction('rw', d.exercises, async () => {
    const key = nameKey(name)
    const clash = await d.exercises.where('nameKey').equals(key).first()
    if (clash && clash.id !== existingId) return { ok: false as const, error: `You already have “${clash.name}”.` }

    if (existingId !== undefined) {
      const cur = await d.exercises.get(existingId)
      if (!cur) return { ok: false as const, error: 'That exercise no longer exists.' }
      const patch: Partial<Exercise> = { equipment: input.equipment, primaryMuscles: primary, secondaryMuscles: secondary, needsReview: false, cardio }
      if (cur.isCustom) Object.assign(patch, { name, nameKey: key })
      await d.exercises.update(existingId, patch)
      return { ok: true as const, exercise: (await d.exercises.get(existingId))! }
    }

    const ex: Exercise = {
      ...buildExercise(name, unit, true), equipment: input.equipment, primaryMuscles: primary, secondaryMuscles: secondary,
      weightIncrement: defaultIncrement(input.equipment, unit), needsReview: false, isCustom: true, cardio,
    }
    ex.id = await d.exercises.add(ex)
    return { ok: true as const, exercise: ex }
  })
}

/** Hides one of your own exercises. Past workouts keep their sets (history is never deleted). */
export async function archiveExercise(id: number, d: LiftLogDB = defaultDb): Promise<boolean> {
  const ex = await d.exercises.get(id)
  if (!ex || !ex.isCustom) return false
  await d.exercises.update(id, { archived: true })
  return true
}
