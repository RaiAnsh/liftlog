import Dexie, { type Table } from 'dexie'
import { DB_NAME } from '../brand'
import { guessMuscles } from '../import/exerciseMap'
import type { ActiveWorkout, Exercise, Routine, Workout, WorkoutSet } from '../types'

export interface SettingRow { key: string; value: unknown }

export class LiftLogDB extends Dexie {
  exercises!: Table<Exercise, number>
  routines!: Table<Routine, number>
  workouts!: Table<Workout, number>
  sets!: Table<WorkoutSet, number>
  settings!: Table<SettingRow, string>
  active!: Table<ActiveWorkout, string>

  constructor(name = DB_NAME) {
    super(name)
    // Always add a new .version(n) with an .upgrade() instead of editing a released one.
    this.version(1).stores({
      exercises: '++id, &nameKey',
      routines: '++id, order',
      workouts: '++id, startedAt, routineId, &importKey',
      sets: '++id, workoutId, exerciseId, [exerciseId+workoutId], &importKey',
      settings: 'key',
    })
    // v2: workout in progress, persisted so closing the app mid-workout loses nothing.
    this.version(2).stores({ active: 'key' })
    // v3: the first muscle map matched "tric" inside "Strict Military Press" and tagged it as triceps.
    // Re-tag only exercises still carrying exactly that wrong tag, so manual edits are never overwritten.
    this.version(3).stores({}).upgrade(async (tx) => {
      await tx.table('exercises').toCollection().modify((e: Exercise) => {
        if (!e.isCustom && /strict|military/i.test(e.name) && e.primaryMuscles.length === 1 && e.primaryMuscles[0] === 'triceps' && e.secondaryMuscles.length === 0) {
          const g = guessMuscles(e.name)
          if (g.known) { e.primaryMuscles = g.primary; e.secondaryMuscles = g.secondary }
        }
      })
    })
  }
}

export const SCHEMA_VERSION = 3
export const db = new LiftLogDB()
