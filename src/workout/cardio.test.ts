import { describe, expect, it } from 'vitest'
import { buildExercise, isCardio } from '../db/exercises'
import type { Exercise, WorkoutSet } from '../types'
import { draftExercise, draftToRows, emptyDraft, toggleComplete, updateSet } from './draft'

const tm: Exercise = { ...buildExercise('Running (Treadmill)', 'lb'), id: 1 }
const bench: Exercise = { ...buildExercise('Bench Press (Barbell)', 'lb'), id: 2 }
const prevSet = (p: Partial<WorkoutSet> = {}): WorkoutSet => ({ workoutId: 9, exerciseId: 1, order: 0, type: 'working', weightKg: 0, reps: 0, rpe: null, distance: 3.2, seconds: 1200, notes: '', completed: true, ...p })

describe('cardio exercises', () => {
  it('recognises cardio from the library, from the flag, and from older rows without the flag', () => {
    expect(isCardio(tm)).toBe(true)
    expect(isCardio(bench)).toBe(false)
    expect(isCardio({ cardio: true, primaryMuscles: ['quads'], needsReview: false })).toBe(true)
    expect(isCardio({ primaryMuscles: [], needsReview: false })).toBe(true) // e.g. imported Running (Treadmill) from before the flag existed
    expect(isCardio({ primaryMuscles: [], needsReview: true })).toBe(false) // unknown, still awaiting tags
  })
  it('starts as one block with no rest timer, while strength starts as three sets', () => {
    const c = draftExercise(tm, { restSeconds: 90 })
    expect(c).toMatchObject({ cardio: true, restSeconds: 0, repMin: null, repMax: null })
    expect(c.sets).toHaveLength(1)
    expect(draftExercise(bench, { restSeconds: 90 }).sets).toHaveLength(3)
  })
  it('needs minutes to complete, fills them (and distance) from last time, and never starts a rest timer', () => {
    const d = emptyDraft(0); d.exercises.push(draftExercise(tm, { restSeconds: 90 }))
    const e = d.exercises[0]
    expect(toggleComplete(d, e.uid, e.sets[0].uid, undefined, 100)).toBe(d) // nothing entered, nothing to fill from
    const filled = toggleComplete(d, e.uid, e.sets[0].uid, [prevSet()], 100)
    expect(filled.exercises[0].sets[0]).toMatchObject({ completed: true, seconds: 1200, distanceKm: 3.2 })
    expect(filled.rest).toBeNull()
    const typed = toggleComplete(updateSet(d, e.uid, e.sets[0].uid, { seconds: 600, distanceKm: 1 }), e.uid, e.sets[0].uid, [prevSet()], 100)
    expect(typed.exercises[0].sets[0]).toMatchObject({ seconds: 600, distanceKm: 1 })
  })
  it('saves cardio as time and distance with zero weight and reps, and strength as before', () => {
    const d = emptyDraft(0)
    d.exercises.push(draftExercise(tm, { restSeconds: 90 }), draftExercise(bench, { restSeconds: 90, sets: 1 }))
    d.exercises[0].sets[0] = { ...d.exercises[0].sets[0], completed: true, seconds: 1500, distanceKm: 4.1 }
    d.exercises[1].sets[0] = { ...d.exercises[1].sets[0], completed: true, weightKg: 60, reps: 8 }
    const { sets } = draftToRows(d, 1)
    expect(sets[0]).toMatchObject({ exerciseId: 1, weightKg: 0, reps: 0, seconds: 1500, distance: 4.1 })
    expect(sets[1]).toMatchObject({ exerciseId: 2, weightKg: 60, reps: 8, seconds: 0, distance: 0 })
  })
})
