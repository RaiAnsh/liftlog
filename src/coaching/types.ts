import type { Exercise, Routine, Workout, WorkoutSet } from '../types'

/** Everything the coaching functions need; they never touch the database or the network. */
export interface History {
  sets: WorkoutSet[]
  workouts: Workout[]
  exercises: Map<number, Exercise>
  routines: Routine[]
}
