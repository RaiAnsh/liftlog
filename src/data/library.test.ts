import { describe, expect, it } from 'vitest'
import { guessEquipment, guessMuscles } from '../import/exerciseMap'
import { GYM_LIBRARY } from './images'
import { LIBRARY } from './library'
import { locate } from '../lib/exerciseGroups'

const CARDIO = /treadmill|bike|elliptical|stair|rowing \(machine\)|running|walking(?! lunge)|hiking|arc trainer|jacob|ski erg|jump rope|swimming|battle rope/i

describe('built-in exercise library', () => {
  it('is large, with no duplicates (ignoring case)', () => {
    expect(GYM_LIBRARY.length).toBeGreaterThan(150)
    expect(new Set(GYM_LIBRARY.map((n) => n.toLowerCase())).size).toBe(GYM_LIBRARY.length)
  })
  it('includes the common lifts people expect, like Hip Thrust in several forms', () => {
    for (const n of ['Hip Thrust (Barbell)', 'Hip Thrust (Machine)', 'Hip Thrust (Smith Machine)', 'Squat (Barbell)', 'Deadlift (Barbell)', 'Bench Press (Barbell)', 'Overhead Press (Barbell)', 'Romanian Deadlift (Barbell)', 'Goblet Squat (Dumbbell)', 'Pull Up', 'Plank']) expect(GYM_LIBRARY, n).toContain(n)
  })
  it('every exercise has known muscles (or is cardio), so coaching can use it', () => {
    const unknown = LIBRARY.filter((n) => !guessMuscles(n).known)
    expect(unknown).toEqual([])
  })
  it('every non-cardio exercise lands in a Push / Pull / Legs / Core section', () => {
    for (const n of LIBRARY.filter((x) => !CARDIO.test(x))) expect(locate(guessMuscles(n).primary).group.id, n).not.toBe('other')
  })
  it('files key lifts under the right muscles', () => {
    const p = (n: string) => guessMuscles(n).primary
    expect(p('Hip Thrust (Barbell)')).toEqual(['glutes'])
    expect(p('Squat (Barbell)')).toContain('quads')
    expect(p('Bench Press (Barbell)')).toContain('chest')
    expect(p('Overhead Press (Barbell)')).toContain('front_delts')
    expect(p('Upright Row (Barbell)')).toEqual(expect.arrayContaining(['side_delts']))
    expect(p('Pullover (Dumbbell)')).toContain('upper_back_lats')
    expect(p('Nordic Hamstring Curl')).toContain('hamstrings')
    expect(p('Deadlift (Barbell)')).toEqual(expect.arrayContaining(['hamstrings', 'glutes']))
  })
  it('guesses equipment from the name', () => {
    expect(guessEquipment('Hip Thrust (Barbell)')).toBe('barbell')
    expect(guessEquipment('Goblet Squat (Dumbbell)')).toBe('dumbbell')
    expect(guessEquipment('Leg Press')).toBe('machine')
  })
})

describe('cardio machines', () => {
  const cardio = GYM_LIBRARY.filter((n) => CARDIO.test(n))
  it('are in the library: treadmill, bikes, elliptical, stair climber, rowing and more', () => {
    for (const n of ['Running (Treadmill)', 'Walking (Treadmill)', 'Incline Walk (Treadmill)', 'Cycling (Bike)', 'Spin Bike', 'Elliptical', 'Stair Climber', 'Rowing (Machine)', 'Arc Trainer', 'Assault Bike']) expect(GYM_LIBRARY, n).toContain(n)
    expect(cardio.length).toBeGreaterThanOrEqual(15)
  })
  it('have no muscles and are filed under Cardio', () => {
    for (const n of cardio) { expect(guessMuscles(n).primary, n).toEqual([]); expect(locate([]).group.label).toBe('Cardio') }
  })
  it('do not swallow strength moves with similar words (Walking Lunge stays a leg exercise)', () => {
    expect(guessMuscles('Walking Lunge (Dumbbell)').primary).toContain('quads')
    expect(guessMuscles('Farmer’s Walk (Dumbbell)').primary).toContain('forearms')
  })
})
