import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { goalPreset } from '../coaching/goals'
import { LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import { guessMuscles } from '../import/exerciseMap'
import { MUSCLES, type Muscle } from '../types'
import { applySplit, exampleById, splitFor, splitKindFor, type SplitKind } from './splits'

const KINDS: SplitKind[] = ['vtaper', 'glutes', 'balanced']
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0

/** Primary muscles trained by each day of a split. */
const musclesOf = (id: string) => new Set(exampleById(id)!.items.flatMap((i) => guessMuscles(i.name).primary))
const daysTraining = (ids: string[], m: Muscle) => ids.filter((id) => musclesOf(id).has(m)).length

describe('weekly split suggestions', () => {
  it('gives a split for every number of days from 1 to 7, for every focus, using real templates', () => {
    for (const k of KINDS) for (let n = 1; n <= 7; n++) {
      const s = splitFor(n, k)!
      expect(s, `${k} ${n}`).toBeTruthy()
      expect(s.ids).toHaveLength(n)
      for (const id of s.ids) expect(exampleById(id), `${k} ${n} ${id}`).toBeTruthy()
      expect(s.note.length).toBeGreaterThan(20)
    }
    expect(splitFor(0, 'vtaper')).toBeNull()
    expect(splitFor(8, 'vtaper')).toBeNull()
  })
  it('follows the requested shapes: PPL for 3 days, and a different split at 4, 5, 6 and 7', () => {
    expect(splitFor(3, 'vtaper')!.ids).toEqual(['push', 'pull', 'legs'])
    expect(splitFor(3, 'balanced')!.ids).toEqual(['push', 'pull', 'legs'])
    const labels = [3, 4, 5, 6, 7].map((n) => splitFor(n, 'vtaper')!.label)
    expect(new Set(labels).size).toBe(5)
    expect(splitFor(5, 'vtaper')!.ids).toEqual(expect.arrayContaining(['shoulders-arms', 'chestback'])) // shoulders/arms and chest/back, as asked
    expect(splitFor(4, 'balanced')!.label).toMatch(/Upper \/ Lower/)
  })
  it('never schedules the same workout twice, so no day repeats back to back', () => {
    for (const k of KINDS) for (let n = 1; n <= 7; n++) {
      const ids = splitFor(n, k)!.ids
      expect(new Set(ids).size, `${k} ${n}`).toBe(ids.length)
    }
  })
  it('V-taper: priority muscles (chest, side delts, lats) are trained at least twice a week from 4 days up, and legs stay lighter than upper body', () => {
    for (let n = 4; n <= 7; n++) {
      const ids = splitFor(n, 'vtaper')!.ids
      for (const m of ['chest', 'side_delts', 'upper_back_lats'] as Muscle[]) expect(daysTraining(ids, m), `${n} days ${m}`).toBeGreaterThanOrEqual(2)
      expect(daysTraining(ids, 'quads')).toBeLessThanOrEqual(daysTraining(ids, 'chest'))
    }
  })
  it('glutes & legs: glutes are trained at least twice a week from 3 days up (three times from 4), with upper body also covered', () => {
    for (let n = 3; n <= 7; n++) {
      const ids = splitFor(n, 'glutes')!.ids
      expect(daysTraining(ids, 'glutes'), `${n} days`).toBeGreaterThanOrEqual(2)
      if (n >= 4) expect(daysTraining(ids, 'glutes')).toBeGreaterThanOrEqual(3)
      for (const m of ['chest', 'upper_back_lats'] as Muscle[]) if (n >= 3) expect(daysTraining(ids, m), `${n} days ${m}`).toBeGreaterThanOrEqual(1)
    }
  })
  it('balanced: from 4 days every major muscle is hit at least twice', () => {
    for (let n = 4; n <= 7; n++) {
      const ids = splitFor(n, 'balanced')!.ids
      for (const m of ['chest', 'upper_back_lats', 'quads', 'hamstrings'] as Muscle[]) expect(daysTraining(ids, m), `${n} days ${m}`).toBeGreaterThanOrEqual(2)
    }
  })
  it('7 days include an easy cardio & core day', () => {
    for (const k of KINDS) expect(splitFor(7, k)!.ids).toContain('cardio-core')
    const cc = exampleById('cardio-core')!
    expect(cc.items.some((i) => guessMuscles(i.name).primary.length === 0)).toBe(true) // contains a cardio exercise
  })
  it('the new workouts train what their names say', () => {
    expect(musclesOf('chestback')).toEqual(expect.objectContaining({}))
    expect([...musclesOf('chestback')]).toEqual(expect.arrayContaining(['chest', 'upper_back_lats']))
    expect([...musclesOf('shoulders-arms')]).toEqual(expect.arrayContaining(['side_delts', 'biceps', 'triceps']))
    expect([...musclesOf('glutes-ham')]).toEqual(expect.arrayContaining(['glutes', 'hamstrings']))
    expect([...musclesOf('quads-glutes')]).toEqual(expect.arrayContaining(['quads', 'glutes']))
    expect([...musclesOf('hams-calves')]).toEqual(expect.arrayContaining(['hamstrings', 'calves']))
    expect([...musclesOf('fullbody-a')].length).toBeGreaterThanOrEqual(5)
  })
})

describe('which family of splits suits the goal', () => {
  it('maps the presets, no goal, and custom goals by what they prioritise', () => {
    expect(splitKindFor(null)).toBe('balanced')
    expect(splitKindFor({ id: 'vtaper', tiers: goalPreset('vtaper')!.tiers })).toBe('vtaper')
    expect(splitKindFor({ id: 'glutes', tiers: goalPreset('glutes')!.tiers })).toBe('glutes')
    expect(splitKindFor({ id: 'balanced', tiers: goalPreset('balanced')!.tiers })).toBe('balanced')
    const lowerCustom = Object.fromEntries(MUSCLES.map((m) => [m, ['glutes', 'quads'].includes(m) ? 'priority' : 'light'])) as Record<Muscle, 'priority' | 'light'>
    expect(splitKindFor({ id: 'custom', tiers: lowerCustom })).toBe('glutes')
    const upperCustom = Object.fromEntries(MUSCLES.map((m) => [m, ['chest', 'biceps', 'triceps'].includes(m) ? 'priority' : 'light'])) as Record<Muscle, 'priority' | 'light'>
    expect(splitKindFor({ id: 'custom', tiers: upperCustom })).toBe('vtaper')
  })
})

describe('applySplit (builds the week and the missing templates)', () => {
  let n = 0
  const fresh = () => new LiftLogDB(`split-${n++}`)
  it('creates the templates you lack and assigns them to the free days, Monday first', async () => {
    const db = fresh()
    const { plan, created } = await applySplit([FRI, MON, WED], splitFor(3, 'vtaper')!, 'lb', db)
    expect(created).toEqual(['Push', 'Pull', 'Legs'])
    const names = (await db.routines.toArray()).map((r) => r.name)
    expect(names).toEqual(['Push', 'Pull', 'Legs'])
    expect([plan[MON], plan[WED], plan[FRI]]).toEqual((await db.routines.toArray()).map((r) => r.id))
    expect([plan[TUE], plan[THU], plan[SAT], plan[SUN]]).toEqual([null, null, null, null])
  })
  it('reuses the lifter\'s own templates by name instead of duplicating them', async () => {
    const db = fresh()
    const bench = buildExercise('Slipine Press', 'lb'); bench.id = await db.exercises.add(bench)
    const mine = await db.routines.add({ name: 'push', order: 0, items: [{ exerciseId: bench.id!, targetSets: 2, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: '' }] })
    const { plan, created } = await applySplit([MON, WED, FRI], splitFor(3, 'vtaper')!, 'lb', db)
    expect(created).toEqual(['Pull', 'Legs']) // their own "push" is kept
    expect(plan[MON]).toBe(mine)
    expect((await db.routines.get(mine))!.items).toHaveLength(1) // and untouched
    expect(await db.routines.count()).toBe(3)
  })
  it('is safe to apply twice: nothing is created again', async () => {
    const db = fresh()
    await applySplit([MON, WED, FRI], splitFor(3, 'vtaper')!, 'lb', db)
    const again = await applySplit([MON, WED, FRI], splitFor(3, 'vtaper')!, 'lb', db)
    expect(again.created).toEqual([])
    expect(await db.routines.count()).toBe(3)
  })
  it('builds a 5-day week with the shoulders & arms and chest & back days', async () => {
    const db = fresh()
    const { plan, created } = await applySplit([MON, TUE, WED, THU, FRI], splitFor(5, 'vtaper')!, 'lb', db)
    expect(created).toEqual(['Push', 'Pull', 'Legs', 'Shoulders & Arms', 'Chest & Back'])
    expect(plan.filter(Boolean)).toHaveLength(5)
  })
  it('creates cardio exercises as cardio so they log time, not reps', async () => {
    const db = fresh()
    await applySplit([MON, TUE, WED, THU, FRI, SAT, SUN], splitFor(7, 'balanced')!, 'lb', db)
    const walk = await db.exercises.where('nameKey').equals('incline walk (treadmill)').first()
    expect(walk?.cardio).toBe(true)
  })
})
