import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { nameKey } from '../db/exercises'
import { PLANET_FITNESS_LIBRARY } from '../data/images'
import { guessMuscles } from '../import/exerciseMap'
import type { Muscle } from '../types'

export interface ExerciseItem { key: string; name: string; muscles: Muscle[]; mine: boolean; pf: boolean; sets: number }

export const PF_KEYS = new Set(PLANET_FITNESS_LIBRARY.map(nameKey))

/** Your exercises (most used first) plus Planet Fitness library entries you haven't added yet. */
export function useExerciseItems(): ExerciseItem[] | undefined {
  return useLiveQuery(async () => {
    const [exs, sets] = await Promise.all([db.exercises.toArray(), db.sets.toArray()])
    const counts = new Map<number, number>()
    for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1)
    const out: ExerciseItem[] = exs.filter((e) => !e.archived).map((e) => ({
      key: e.nameKey, name: e.name, muscles: e.primaryMuscles, mine: true, pf: PF_KEYS.has(e.nameKey), sets: counts.get(e.id!) ?? 0,
    }))
    const have = new Set(out.map((o) => o.key))
    for (const n of PLANET_FITNESS_LIBRARY) {
      if (!have.has(nameKey(n))) out.push({ key: nameKey(n), name: n, muscles: guessMuscles(n).primary, mine: false, pf: true, sets: 0 })
    }
    return out.sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name))
  })
}
