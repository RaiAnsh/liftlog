import type { SessionPoint } from '../lib/exerciseStats'
import type { Exercise, Muscle } from '../types'

export interface Plateau { sessions: number; topWeightKg: number; e1rmKg: number }

const EPS = 1e-6
const WINDOW_DAYS = 42

/**
 * Stalled: across the last 3 sessions of a lift, neither top-set weight nor e1RM beat the first of
 * those three. Bodyweight-only lifts and lifts you haven't done in 6 weeks are ignored.
 */
export function detectPlateau(points: SessionPoint[], now: number): Plateau | null {
  if (points.length < 3) return null
  const [a, b, c] = points.slice(-3)
  if (now - c.date > WINDOW_DAYS * 86_400_000) return null
  if (a.topWeightKg <= 0) return null
  const noGain = (x: number, y: number, z: number) => y <= x + EPS && z <= x + EPS
  const weightStalled = noGain(a.topWeightKg, b.topWeightKg, c.topWeightKg)
  const e1rmStalled = a.e1rmKg <= 0 || noGain(a.e1rmKg, b.e1rmKg, c.e1rmKg)
  return weightStalled && e1rmStalled ? { sessions: points.length, topWeightKg: c.topWeightKg, e1rmKg: c.e1rmKg } : null
}

export const REP_RANGE_PRESETS = [
  { label: 'Heavy 4–6', min: 4, max: 6 },
  { label: 'Strength 6–8', min: 6, max: 8 },
  { label: 'Classic 8–12', min: 8, max: 12 },
  { label: 'Higher 12–15', min: 12, max: 15 },
]

/** Alternatives for the same primary muscle, most-used first. */
export function similarExercises(ex: Exercise, all: Exercise[], usage: Map<number, number>): Exercise[] {
  const mine = new Set<Muscle>(ex.primaryMuscles)
  if (!mine.size) return []
  return all
    .filter((e) => e.id !== ex.id && !e.archived && e.primaryMuscles.some((m) => mine.has(m)))
    .sort((a, b) => (usage.get(b.id!) ?? 0) - (usage.get(a.id!) ?? 0))
}
