import 'fake-indexeddb/auto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LiftLogDB } from '../db/db'
import { importStrongCsv } from './importer'
import { guessMuscles } from './exerciseMap'
import { parseDuration, parseStrongWorkouts } from './strong'

const fx = (n: string) => readFileSync(new URL(`../__fixtures__/${n}`, import.meta.url), 'utf8')
let n = 0
const freshDb = () => new LiftLogDB(`test-${n++}`)

describe('parseDuration', () => {
  it.each([
    ['1h 5min', 65], ['45min', 45], ['3min', 3], ['45m', 45], ['1h', 60], ['1:05:00', 65], ['', null], ['abc', null],
  ])('%s -> %s', (raw, mins) => expect(parseDuration(raw)).toBe(mins))
})

describe('parseStrongWorkouts (real Strong format)', () => {
  const p = parseStrongWorkouts(fx('strong_sample.csv'))

  it('detects the comma delimiter and groups by date + workout name', () => {
    expect(p.delimiter).toBe(',')
    expect(p.workouts.map((w) => w.name)).toEqual(['Push Day', 'Legs', 'Pull'])
  })

  it('maps warm-up, drop and failure markers; unknown markers become working with a warning', () => {
    const push = p.workouts[0]
    const types = push.sets.map((s) => [s.setOrderRaw, s.type])
    expect(types).toContainEqual(['W', 'warmup'])
    expect(types).toContainEqual(['D', 'drop'])
    expect(types).toContainEqual(['F', 'failure'])
    expect(types).toContainEqual(['X', 'working'])
    expect(p.warnings.some((w) => w.includes('"X"'))).toBe(true)
  })

  it('keeps quoted notes with commas and newlines intact', () => {
    const push = p.workouts[0]
    expect(push.notes).toBe('Felt good, strong')
    expect(push.sets.find((s) => s.notes.includes('shoulder tight'))?.notes).toBe('grip was wide, left\nshoulder tight')
  })

  it('skips rest timer, empty and unreadable rows with reasons', () => {
    const reasons = p.skipped.map((s) => s.reason)
    expect(reasons.some((r) => r.startsWith('Rest Timer'))).toBe(true)
    expect(reasons.some((r) => r.startsWith('Empty set'))).toBe(true)
    expect(reasons.some((r) => r.startsWith('Unreadable date'))).toBe(true)
  })

  it('keeps cardio rows (seconds only) and parses RPE', () => {
    const legs = p.workouts[1]
    expect(legs.sets.find((s) => s.exerciseName.startsWith('Running'))?.seconds).toBe(600)
    expect(p.workouts[0].sets.find((s) => s.rpe === 8)).toBeTruthy()
  })

  it('gives repeated exercise rows distinct import keys', () => {
    const keys = p.workouts[0].sets.map((s) => s.importKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('drops implausible durations', () => {
    expect(p.workouts[2].durationMin).toBeNull()
    expect(p.workouts[0].durationMin).toBe(65)
  })
})

describe('semicolon delimiter', () => {
  it('parses decimal commas and quoted semicolons', () => {
    const p = parseStrongWorkouts(fx('strong_semicolon.csv'))
    expect(p.delimiter).toBe(';')
    expect(p.workouts[0].sets).toHaveLength(2)
    expect(p.workouts[0].sets[0].weight).toBe(60.5)
    expect(p.workouts[0].sets[0].notes).toBe('note; with semicolon')
  })
})

describe('importStrongCsv', () => {
  it('imports, converts lb to kg, and is idempotent on re-import', async () => {
    const db = freshDb()
    const first = await importStrongCsv(fx('strong_sample.csv'), 'lb', db)
    expect(first.workoutsAdded).toBe(3)
    expect(first.setsAdded).toBe(11)
    const bench = (await db.sets.toArray()).find((s) => s.weightKg > 60 && s.weightKg < 62)
    expect(bench?.weightKg).toBeCloseTo(135 * 0.45359237, 3)

    const again = await importStrongCsv(fx('strong_sample.csv'), 'lb', db)
    expect(again.workoutsAdded).toBe(0)
    expect(again.setsAdded).toBe(0)
    expect(again.setsDuplicate).toBe(11)
    expect(await db.sets.count()).toBe(11)
    expect(await db.workouts.count()).toBe(3)
    expect(await db.exercises.count()).toBe(first.exercisesTotal)
  })

  it('auto-tags known exercises and flags unknown ones for review', async () => {
    const db = freshDb()
    const s = await importStrongCsv(fx('strong_sample.csv'), 'kg', db)
    const bench = await db.exercises.where('nameKey').equals('bench press (barbell)').first()
    expect(bench?.primaryMuscles).toEqual(['chest'])
    expect(bench?.equipment).toBe('barbell')
    expect(s.needingTags).toBe(1)
    expect((await db.exercises.toArray()).find((e) => e.needsReview)?.name).toBe('Mystery Gadget Thing')
  })

  it('summarises date range', async () => {
    const s = await importStrongCsv(fx('strong_sample.csv'), 'kg', freshDb())
    expect(new Date(s.firstDate!).getDate()).toBe(4)
    expect(new Date(s.lastDate!).getDate()).toBe(8)
  })
})

describe('exercise muscle map', () => {
  it('does not mistake "Strict" for triceps', () => {
    expect(guessMuscles('Strict Military Press (Barbell)').primary).toEqual(['front_delts'])
  })
  it.each([
    ['Lateral Raise (Dumbbell)', 'side_delts'], ['Triceps Extension (Machine)', 'triceps'],
    ['Lying Leg Curl (Machine)', 'hamstrings'], ['Bicep Curl (Dumbbell)', 'biceps'],
    ['Calf Press on Seated Leg Press', 'calves'], ['Incline Row (Dumbbell)', 'upper_back_lats'],
    ['Lat Pulldown (Cable)', 'upper_back_lats'], ['Hack Squat', 'quads'], ['Pec Deck (Machine)', 'chest'],
    ['rear deltoids (cable)', 'rear_delts'], ['Strict Military Press (Barbell)', 'front_delts'], ['Hip Adductor (Machine)', 'glutes'], ['Hip Abductor (Machine)', 'glutes'],
    ['Triceps Pushdown (Cable - Straight Bar)', 'triceps'], ['Skullcrusher (Dumbbell)', 'triceps'],
  ])('%s -> %s', (name, muscle) => expect(guessMuscles(name).primary).toContain(muscle))
})

// Runs only on a machine that has the private export (sample-data/ is gitignored).
const real = new URL('../../sample-data/strong_workouts.csv', import.meta.url)
describe.skipIf(!existsSync(real))('real Strong export', () => {
  it('imports fully and re-import adds nothing', async () => {
    const text = readFileSync(real, 'utf8')
    const db = freshDb()
    const a = await importStrongCsv(text, 'lb', db)
    console.log({ ...a, skipped: a.skipped.length, warnings: a.warnings })
    expect(a.workoutsAdded).toBe(367)
    expect(a.setsAdded).toBe(5136 - a.skipped.filter((s) => !s.reason.startsWith('Rest')).length)
    const b = await importStrongCsv(text, 'lb', db)
    expect(b.setsAdded + b.workoutsAdded + b.exercisesAdded).toBe(0)
  })
})
