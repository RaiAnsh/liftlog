import Papa from 'papaparse'
import { fromKg } from '../units'
import type { Exercise, Unit, Workout, WorkoutSet } from '../types'

const HEADER = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE']
const p2 = (n: number) => String(n).padStart(2, '0')

export const strongDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

export function strongDuration(startedAt: number, endedAt: number | null): string {
  if (endedAt === null) return ''
  const m = Math.max(0, Math.round((endedAt - startedAt) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m}min`
}

/**
 * Workouts in Strong's CSV layout (the same one the importer reads), so the data can move to other apps
 * or back into ARLog. Numbered sets are 1, 2, 3…; warm-ups, drop sets and failure sets use W, D and F.
 * Weights are written in the unit you choose, and Strong-format files don't say which, so keep it in the name.
 */
export function exportStrongCsv(workouts: Workout[], sets: WorkoutSet[], exercises: Map<number, Exercise>, unit: Unit): string {
  const byWorkout = new Map<number, WorkoutSet[]>()
  for (const s of sets) (byWorkout.get(s.workoutId) ?? byWorkout.set(s.workoutId, []).get(s.workoutId)!).push(s)

  const rows: (string | number)[][] = []
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const date = strongDate(w.startedAt)
    const dur = strongDuration(w.startedAt, w.endedAt)
    const counters = new Map<number, number>()
    for (const s of (byWorkout.get(w.id!) ?? []).sort((a, b) => a.order - b.order)) {
      if (!s.completed) continue
      let marker: string | number
      if (s.type === 'warmup') marker = 'W'
      else if (s.type === 'drop') marker = 'D'
      else if (s.type === 'failure') marker = 'F'
      else { marker = (counters.get(s.exerciseId) ?? 0) + 1; counters.set(s.exerciseId, marker) }
      rows.push([
        date, w.name, dur, exercises.get(s.exerciseId)?.name ?? 'Unknown exercise', marker,
        Math.round(fromKg(s.weightKg, unit) * 100) / 100, s.reps, s.distance, s.seconds, s.notes, w.notes, s.rpe ?? '',
      ])
    }
  }
  return Papa.unparse({ fields: HEADER, data: rows }, { newline: '\n' })
}

export const strongCsvFilename = (unit: Unit, now = Date.now()) => `arlog-strong-format-${unit}-${new Date(now).toISOString().slice(0, 10)}.csv`
