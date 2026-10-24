import { db as defaultDb, type LiftLogDB } from '../db/db'
import { toKg } from '../units'
import { buildExercise, nameKey } from '../db/exercises'
import type { Exercise, Unit, WorkoutSet } from '../types'
import { parseStrongWorkouts, type ParseResult, type SkippedRow } from './strong'

export interface ImportSummary {
  workoutsAdded: number
  workoutsExisting: number
  setsAdded: number
  setsDuplicate: number
  exercisesAdded: number
  exercisesTotal: number
  needingTags: number
  firstDate: number | null
  lastDate: number | null
  skipped: SkippedRow[]
  warnings: string[]
}

export function describeParse(parsed: ParseResult) {
  const sets = parsed.workouts.reduce((n, w) => n + w.sets.length, 0)
  const dates = parsed.workouts.map((w) => w.startedAt)
  return {
    workouts: parsed.workouts.length,
    sets,
    exercises: new Set(parsed.workouts.flatMap((w) => w.sets.map((s) => nameKey(s.exerciseName)))).size,
    firstDate: dates.length ? Math.min(...dates) : null,
    lastDate: dates.length ? Math.max(...dates) : null,
  }
}

/** Writes parsed workouts to the database. Safe to run repeatedly with the same file. */
export async function commitWorkoutImport(
  parsed: ParseResult, unit: Unit, d: LiftLogDB = defaultDb,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    workoutsAdded: 0, workoutsExisting: 0, setsAdded: 0, setsDuplicate: 0,
    exercisesAdded: 0, exercisesTotal: 0, needingTags: 0,
    firstDate: null, lastDate: null, skipped: parsed.skipped, warnings: parsed.warnings,
  }

  await d.transaction('rw', d.exercises, d.workouts, d.sets, async () => {
    const exByKey = new Map<string, Exercise>()
    for (const e of await d.exercises.toArray()) exByKey.set(e.nameKey, e)

    for (const w of [...parsed.workouts].sort((a, b) => a.startedAt - b.startedAt)) {
      for (const s of w.sets) {
        const key = nameKey(s.exerciseName)
        if (exByKey.has(key)) continue
        const ex = buildExercise(s.exerciseName, unit)
        ex.id = await d.exercises.add(ex)
        exByKey.set(key, ex)
        summary.exercisesAdded++
      }

      let workoutId: number
      const existingWorkout = await d.workouts.where('importKey').equals(w.importKey).first()
      if (existingWorkout) {
        workoutId = existingWorkout.id!
        summary.workoutsExisting++
      } else {
        const endedAt = w.durationMin === null ? null : w.startedAt + w.durationMin * 60_000
        workoutId = await d.workouts.add({
          routineId: null, name: w.name, startedAt: w.startedAt, endedAt,
          notes: w.notes, source: 'strong-import', importKey: w.importKey,
        })
        summary.workoutsAdded++
      }

      const existing = new Set(
        (await d.sets.where('workoutId').equals(workoutId).toArray()).map((x) => x.importKey),
      )
      const fresh: WorkoutSet[] = []
      for (const s of w.sets) {
        const importKey = s.importKey
        if (existing.has(importKey)) { summary.setsDuplicate++; continue }
        fresh.push({
          workoutId, exerciseId: exByKey.get(nameKey(s.exerciseName))!.id!, order: s.order,
          type: s.type, weightKg: toKg(s.weight, unit), reps: s.reps, rpe: s.rpe,
          distance: s.distance, seconds: s.seconds, notes: s.notes, completed: true, importKey,
        })
      }
      await d.sets.bulkAdd(fresh)
      summary.setsAdded += fresh.length
    }
  })

  const info = describeParse(parsed)
  summary.firstDate = info.firstDate
  summary.lastDate = info.lastDate
  summary.exercisesTotal = await d.exercises.count()
  summary.needingTags = (await d.exercises.toArray()).filter((e) => e.needsReview).length
  return summary
}

export async function importStrongCsv(text: string, unit: Unit, d: LiftLogDB = defaultDb) {
  return commitWorkoutImport(parseStrongWorkouts(text), unit, d)
}
