import { describe, expect, it } from 'vitest'
import type { ActiveWorkout, DraftSet } from '../types'
import { draftExercise, emptyDraft, newSet } from './draft'
import { buildExercise } from '../db/exercises'
import { fireFor, isHit, restPhrase, streakOf } from './momentum'

const ex = { ...buildExercise('Bench Press (Barbell)', 'lb'), id: 1 }
const mk = (sets: Partial<DraftSet>[]): ActiveWorkout => {
  const d = emptyDraft(0)
  const e = draftExercise(ex, { restSeconds: 90, sets: 0 })
  e.sets = sets.map((s, i) => ({ ...newSet(), completed: true, doneAt: 1000 + i, hit: false, weightKg: 60, reps: 8, ...s }))
  d.exercises.push(e)
  return d
}

describe('momentum streaks', () => {
  it('counts consecutive on-target sets, newest first, and a miss resets it', () => {
    expect(streakOf(mk([{ hit: true }, { hit: true }, { hit: true }]))).toBe(3)
    expect(streakOf(mk([{ hit: true }, { hit: false }, { hit: true }, { hit: true }]))).toBe(2)
    expect(streakOf(mk([{ hit: true }, { hit: true }, { hit: false }]))).toBe(0)
  })
  it('ignores warm-ups and unfinished sets, and orders by completion time not position', () => {
    expect(streakOf(mk([{ hit: true }, { type: 'warmup', hit: false }, { hit: true }]))).toBe(2)
    expect(streakOf(mk([{ hit: true }, { completed: false, hit: false, doneAt: undefined }, { hit: true }]))).toBe(2)
    expect(streakOf(mk([{ hit: false, doneAt: 5000 }, { hit: true, doneAt: 1 }, { hit: true, doneAt: 2 }]))).toBe(0)
    expect(streakOf(mk([]))).toBe(0)
  })
  it('judges a set against its target, or the bottom of the rep range when there is none', () => {
    expect(isHit({ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 10 }, 8)).toBe(true)
    expect(isHit({ weightKg: 60, reps: 9 }, { weightKg: 60, reps: 10 }, 8)).toBe(false)
    expect(isHit({ weightKg: 40, reps: 8 }, null, 8)).toBe(true)
    expect(isHit({ weightKg: 40, reps: 6 }, null, 8)).toBe(false)
    expect(isHit({ weightKg: 40, reps: 0 }, null, 0)).toBe(false)
  })
})

describe('fire milestones', () => {
  it('fires at 3, 5, 8 and every 4 after, escalating', () => {
    expect([1, 2, 4, 6, 7].map((n) => fireFor(n, false))).toEqual([null, null, null, null, null])
    expect(fireFor(3, false)).toMatchObject({ level: 1, title: 'YOU’RE ON FIRE!' })
    expect(fireFor(5, false)).toMatchObject({ level: 2 })
    expect(fireFor(8, false)).toMatchObject({ level: 3, title: 'INFERNO!' })
    expect(fireFor(12, false)).toMatchObject({ level: 3 })
    expect(fireFor(9, false)).toBeNull()
  })
  it('a PR always lights it up, at least level 2', () => {
    expect(fireFor(0, true)).toMatchObject({ level: 2, title: 'NEW PR!' })
    expect(fireFor(8, true)).toMatchObject({ level: 3, title: 'NEW PR!' })
  })
  it('rest phrases are stable and never empty', () => {
    expect(restPhrase(3)).toBe(restPhrase(3))
    for (let i = 0; i < 20; i++) expect(restPhrase(i).length).toBeGreaterThan(5)
  })
})
