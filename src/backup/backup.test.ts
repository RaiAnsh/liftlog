import 'fake-indexeddb/auto'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LiftLogDB, SCHEMA_VERSION } from '../db/db'
import { buildExercise } from '../db/exercises'
import { importStrongCsv } from '../import/importer'
import { parseStrongWorkouts } from '../import/strong'
import type { Exercise } from '../types'
import { backupDue, createBackup, parseBackup, restoreBackup } from './backup'
import { exportStrongCsv, strongDuration } from './strongCsv'

let n = 0
const freshDb = () => new LiftLogDB(`bk-${n++}`)
const fx = (name: string) => readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8')
const DAY = 86_400_000

async function seeded() {
  const db = freshDb()
  await importStrongCsv(fx('strong_sample.csv'), 'lb', db)
  const ex = await db.exercises.toArray()
  await db.routines.add({ name: 'Push', order: 0, items: [{ exerciseId: ex[0].id!, targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: 'seat 4' }] })
  await db.settings.bulkPut([{ key: 'units', value: 'lb' }, { key: 'program', value: [1] }])
  return db
}

describe('backup and restore', () => {
  it('round-trips every table through JSON text onto a different device', async () => {
    const a = await seeded()
    const text = JSON.stringify(await createBackup(a, 1_700_000_000_000))

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.summary).toMatchObject({ workouts: 3, sets: 11, routines: 1 })

    const b = freshDb() // "another device", with its own stale data
    await b.exercises.add(buildExercise('Stale Exercise', 'kg'))
    await restoreBackup(parsed.file, b)

    expect(await b.workouts.count()).toBe(await a.workouts.count())
    expect(await b.sets.count()).toBe(await a.sets.count())
    expect(await b.exercises.toArray()).toEqual(await a.exercises.toArray()) // ids preserved, stale one gone
    expect(await b.routines.toArray()).toEqual(await a.routines.toArray())
    expect((await b.settings.get('units'))?.value).toBe('lb')
    expect((await b.settings.get('lastBackupAt'))?.value).toBe(1_700_000_000_000)
  })

  it('keeps sets pointing at the right workouts and exercises after restore', async () => {
    const a = await seeded()
    const b = freshDb()
    const parsed = parseBackup(JSON.stringify(await createBackup(a)))
    if (!parsed.ok) throw new Error('parse')
    await restoreBackup(parsed.file, b)
    const exIds = new Set((await b.exercises.toArray()).map((e) => e.id))
    const wkIds = new Set((await b.workouts.toArray()).map((w) => w.id))
    for (const s of await b.sets.toArray()) { expect(exIds.has(s.exerciseId)).toBe(true); expect(wkIds.has(s.workoutId)).toBe(true) }
    // Re-importing the same Strong file into the restored database still adds nothing (import keys survived).
    const again = await importStrongCsv(fx('strong_sample.csv'), 'lb', b)
    expect(again.setsAdded + again.workoutsAdded).toBe(0)
  })

  it('clears the workout in progress on restore', async () => {
    const a = await seeded()
    const parsed = parseBackup(JSON.stringify(await createBackup(a)))
    if (!parsed.ok) throw new Error('parse')
    const b = freshDb()
    await b.active.put({ key: 'current', name: 'x', routineId: null, startedAt: 1, notes: '', exercises: [], rest: null })
    await restoreBackup(parsed.file, b)
    expect(await b.active.count()).toBe(0)
  })

  it('rejects files that are not valid backups, with plain-English reasons', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, error: expect.stringContaining('readable') })
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, error: expect.stringContaining('ARLog backup') })
    expect(parseBackup(JSON.stringify({ format: 'liftlog-backup', tables: {} }))).toMatchObject({ ok: false, error: expect.stringContaining('version') })
    expect(parseBackup(JSON.stringify({ format: 'liftlog-backup', schemaVersion: SCHEMA_VERSION, tables: { exercises: [] } }))).toMatchObject({ ok: false, error: expect.stringContaining('missing') })
  })

  it('refuses a backup from a newer app version', () => {
    const r = parseBackup(JSON.stringify({ format: 'liftlog-backup', schemaVersion: SCHEMA_VERSION + 1, exportedAt: 1, tables: { exercises: [], routines: [], workouts: [], sets: [] } }))
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('newer version') })
  })

  it('accepts an older schema version and ignores retired tables', () => {
    const r = parseBackup(JSON.stringify({ format: 'liftlog-backup', schemaVersion: 1, exportedAt: 5, tables: { exercises: [], routines: [], workouts: [], sets: [], measurements: [{ id: 1 }] } }))
    expect(r.ok).toBe(true)
  })

  it('drops orphaned sets with a warning instead of failing', () => {
    const ex = { ...buildExercise('A', 'kg'), id: 1 } as Exercise
    const r = parseBackup(JSON.stringify({
      format: 'liftlog-backup', schemaVersion: SCHEMA_VERSION, exportedAt: 1,
      tables: { exercises: [ex], routines: [], workouts: [{ id: 1, startedAt: 5, name: 'w' }], sets: [{ workoutId: 1, exerciseId: 1 }, { workoutId: 99, exerciseId: 1 }, { workoutId: 1, exerciseId: 42 }] },
    }))
    expect(r.ok && r.summary.sets).toBe(1)
    expect(r.ok && r.warnings[0]).toContain('2 sets')
  })

  it('does not wipe existing data when the backup is invalid', async () => {
    const a = await seeded()
    const before = await a.sets.count()
    expect(parseBackup('{}').ok).toBe(false) // callers never reach restore on a failed parse
    expect(await a.sets.count()).toBe(before)
  })
})

describe('backup reminder', () => {
  const now = 1_000 * DAY
  it('is due after 14 days, counting from install when never backed up', () => {
    expect(backupDue(now - 13 * DAY, null, now, true)).toBe(false)
    expect(backupDue(now - 14 * DAY, null, now, true)).toBe(true)
    expect(backupDue(null, now - 20 * DAY, now, true)).toBe(true)
    expect(backupDue(null, now - 2 * DAY, now, true)).toBe(false)
  })
  it('stays quiet with no data or no reference date', () => {
    expect(backupDue(null, now - 90 * DAY, now, false)).toBe(false)
    expect(backupDue(null, null, now, true)).toBe(false)
  })
})

describe('Strong-format CSV export', () => {
  it('round-trips through the importer: same workouts, sets, weights, types and notes', async () => {
    const a = await seeded()
    const csv = exportStrongCsv(await a.workouts.toArray(), await a.sets.toArray(), new Map((await a.exercises.toArray()).map((e) => [e.id!, e])), 'lb')
    expect(csv.split('\n')[0]).toBe('Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE')

    const parsed = parseStrongWorkouts(csv)
    expect(parsed.skipped).toHaveLength(0)
    expect(parsed.workouts).toHaveLength(3)
    const orig = parseStrongWorkouts(fx('strong_sample.csv'))
    const flat = (r: typeof parsed) => r.workouts.flatMap((w) => w.sets.map((s) => [w.name, s.exerciseName, s.type, s.weight, s.reps, s.rpe, s.notes]))
    const sortKey = (x: unknown[]) => JSON.stringify(x)
    expect(flat(parsed).map(sortKey).sort()).toEqual(flat(orig).filter(Boolean).map(sortKey).sort())
    expect(parsed.workouts.map((w) => w.startedAt).sort()).toEqual(orig.workouts.map((w) => w.startedAt).sort())
  })

  it('numbers working sets per exercise and marks W / D / F', async () => {
    const a = await seeded()
    const csv = exportStrongCsv(await a.workouts.toArray(), await a.sets.toArray(), new Map((await a.exercises.toArray()).map((e) => [e.id!, e])), 'lb')
    const lines = csv.split('\n').filter((l) => l.includes('Triceps Pushdown'))
    expect(lines.map((l) => l.split(',')[4])).toEqual(['1', 'D', 'F'])
  })

  it('writes weights in the chosen unit and formats durations like Strong', async () => {
    const a = await seeded()
    const exMap = new Map((await a.exercises.toArray()).map((e) => [e.id!, e]))
    const kg = exportStrongCsv(await a.workouts.toArray(), await a.sets.toArray(), exMap, 'kg')
    expect(parseStrongWorkouts(kg).workouts[0].sets.some((s) => Math.abs(s.weight - 135 * 0.45359237) < 0.01)).toBe(true)
    expect(strongDuration(0, 65 * 60000)).toBe('1h 5min')
    expect(strongDuration(0, 45 * 60000)).toBe('45min')
    expect(strongDuration(0, null)).toBe('')
  })

  it('quotes notes containing commas and newlines', async () => {
    const a = await seeded()
    const csv = exportStrongCsv(await a.workouts.toArray(), await a.sets.toArray(), new Map((await a.exercises.toArray()).map((e) => [e.id!, e])), 'lb')
    const note = parseStrongWorkouts(csv).workouts.flatMap((w) => w.sets).find((s) => s.notes.includes('shoulder tight'))
    expect(note?.notes).toBe('grip was wide, left\nshoulder tight')
  })
})

describe('repo hygiene', () => {
  it('never tracks sample-data/ in git', () => {
    if (!existsSync(new URL('../../.git', import.meta.url))) return // not a git checkout (e.g. a tarball)
    const tracked = execSync('git ls-files sample-data', { cwd: new URL('../../', import.meta.url) }).toString().trim()
    expect(tracked).toBe('')
  })
  it('ignores sample-data/ in .gitignore', () => {
    expect(readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8')).toMatch(/^sample-data\/?$/m)
  })
})
