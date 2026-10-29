import type { WorkoutSet } from '../types'

export const isHard = (s: WorkoutSet) => s.completed && s.type !== 'warmup'

/** Epley estimate; only meaningful for reps <= 12. */
export const e1rm = (kg: number, reps: number) => (reps > 0 && reps <= 12 ? kg * (1 + reps / 30) : 0)

export function volumeKg(sets: WorkoutSet[]): number {
  return sets.filter(isHard).reduce((n, s) => n + s.weightKg * s.reps, 0)
}

/** Best set of an exercise: highest e1RM, falling back to heaviest weight then most reps. */
export function bestSet(sets: WorkoutSet[]): WorkoutSet | null {
  const hard = sets.filter(isHard)
  if (!hard.length) return null
  return hard.reduce((a, b) => {
    const ea = e1rm(a.weightKg, a.reps), eb = e1rm(b.weightKg, b.reps)
    if (ea !== eb) return eb > ea ? b : a
    if (a.weightKg !== b.weightKg) return b.weightKg > a.weightKg ? b : a
    return b.reps > a.reps ? b : a
  })
}

export function groupByExercise(sets: WorkoutSet[]) {
  const groups: { exerciseId: number; sets: WorkoutSet[] }[] = []
  for (const s of sets) {
    const g = groups.find((x) => x.exerciseId === s.exerciseId)
    if (g) g.sets.push(s)
    else groups.push({ exerciseId: s.exerciseId, sets: [s] })
  }
  return groups
}

export const formatDuration = (startedAt: number, endedAt: number | null) => {
  if (!endedAt) return null
  const m = Math.round((endedAt - startedAt) / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export const formatVolume = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString())

/** "20 min · 1.9 mi" for a cardio set. */
export function fmtCardio(seconds: number, distanceKm: number, unit: 'lb' | 'kg'): string {
  const mins = seconds >= 600 ? Math.round(seconds / 60) : Math.round(seconds / 6) / 10
  const d = distanceKm > 0 ? ` · ${Math.round((unit === 'lb' ? distanceKm * 0.621371 : distanceKm) * 100) / 100} ${unit === 'lb' ? 'mi' : 'km'}` : ''
  return `${mins} min${d}`
}
