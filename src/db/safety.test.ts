import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DB_NAME } from '../brand'
import { createBackup, parseBackup, restoreBackup } from '../backup/backup'
import { AUTO_INTERVAL_MS, KEEP_POINTS, listRestorePoints, maybeAutoRestorePoint, restoreFromPoint, SafetyDB, saveRestorePoint } from '../backup/restorePoint'
import { importStrongCsv } from '../import/importer'
import { LiftLogDB, SCHEMA_VERSION } from './db'

let n = 0
const uniq = (p: string) => `${p}-${n++}`
const fixture = readFileSync(new URL('../__fixtures__/strong_sample.csv', import.meta.url), 'utf8')

/**
 * FROZEN copy of the schema exactly as released. Do not edit these: they stand in for the database that
 * already exists on a phone. Future versions must be ADDED to LiftLogDB (never edited) and these tests must
 * keep passing, which proves an app update can open and upgrade data that was saved by an older release.
 */
const RELEASED = {
  v1: { exercises: '++id, &nameKey', routines: '++id, order', workouts: '++id, startedAt, routineId, &importKey', sets: '++id, workoutId, exerciseId, [exerciseId+workoutId], &importKey', settings: 'key' },
  v2: { active: 'key' },
}

function releasedDb(name: string) {
  const d = new Dexie(name)
  d.version(1).stores(RELEASED.v1)
  d.version(2).stores(RELEASED.v2)
  d.version(3).stores({})
  return d
}

describe('database identity', () => {
  it('keeps the database name "liftlog" so renaming the app never orphans saved data', () => {
    expect(DB_NAME).toBe('liftlog')
    expect(new LiftLogDB().name).toBe('liftlog')
  })
  it('never edits a released schema version (only adds new ones)', () => {
    const d = new LiftLogDB(uniq('ver')) as unknown as { _versions: { _cfg: { version: number; storesSource: Record<string, string | null> } }[] }
    const byVersion = new Map(d._versions.map((v) => [v._cfg.version, v._cfg.storesSource]))
    expect(byVersion.get(1)).toEqual(RELEASED.v1)
    expect(byVersion.get(2)).toEqual(RELEASED.v2)
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3)
  })
})

describe('updating the app keeps your data', () => {
  it('opens a database saved by the released version, upgrades it, and every row survives', async () => {
    const name = uniq('released')
    // 1) The phone's existing database, written by the previous release.
    const old = releasedDb(name)
    await old.open()
    const ex = await old.table('exercises').add({ name: 'Bench Press (Barbell)', nameKey: 'bench press (barbell)', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [], weightIncrement: 2.27, repRangeMin: 8, repRangeMax: 12, isCustom: false, archived: false, needsReview: false })
    const wk = await old.table('workouts').add({ routineId: null, name: 'Push', startedAt: 1_700_000_000_000, endedAt: null, notes: 'felt strong', source: 'app' })
    await old.table('sets').bulkAdd([
      { workoutId: wk, exerciseId: ex, order: 0, type: 'working', weightKg: 60, reps: 8, rpe: 8, distance: 0, seconds: 0, notes: '', completed: true },
      { workoutId: wk, exerciseId: ex, order: 1, type: 'working', weightKg: 60, reps: 7, rpe: null, distance: 0, seconds: 0, notes: 'grind', completed: true },
    ])
    await old.table('routines').add({ name: 'My Push', order: 0, items: [{ exerciseId: ex, targetSets: 3, repRangeMin: 8, repRangeMax: 12, restSeconds: 90, notes: 'seat 4' }] })
    await old.table('settings').bulkPut([{ key: 'units', value: 'kg' }, { key: 'weeklyTargets', value: { chest: { min: 12, max: 20 } } }])
    await old.table('active').put({ key: 'current', name: 'In progress', routineId: null, startedAt: 5, notes: '', exercises: [], rest: null })
    const before = {
      exercises: await old.table('exercises').toArray(), workouts: await old.table('workouts').toArray(), sets: await old.table('sets').toArray(),
      routines: await old.table('routines').toArray(), settings: await old.table('settings').toArray(), active: await old.table('active').toArray(),
    }
    old.close()

    // 2) The app after an update opens the same database.
    const updated = new LiftLogDB(name)
    await updated.open()
    expect(await updated.exercises.toArray()).toEqual(before.exercises)
    expect(await updated.workouts.toArray()).toEqual(before.workouts)
    expect(await updated.sets.toArray()).toEqual(before.sets)
    expect(await updated.routines.toArray()).toEqual(before.routines)
    expect(await updated.settings.toArray()).toEqual(before.settings)
    expect(await updated.active.toArray()).toEqual(before.active) // even a workout in progress survives
    updated.close()
  })

  it('a database full of imported history survives reopening and still dedupes re-imports', async () => {
    const name = uniq('history')
    const a = new LiftLogDB(name)
    const first = await importStrongCsv(fixture, 'lb', a)
    a.close()
    const b = new LiftLogDB(name) // "next launch"
    expect(await b.sets.count()).toBe(first.setsAdded)
    expect((await importStrongCsv(fixture, 'lb', b)).setsAdded).toBe(0)
  })

  it('if a future upgrade throws, the old data is untouched and still opens', async () => {
    const name = uniq('failed-upgrade')
    const old = releasedDb(name)
    await old.open()
    await old.table('workouts').add({ routineId: null, name: 'Keep me', startedAt: 1, endedAt: null, notes: '', source: 'app' })
    old.close()

    const buggy = new Dexie(name)
    buggy.version(1).stores(RELEASED.v1)
    buggy.version(2).stores(RELEASED.v2)
    buggy.version(3).stores({})
    buggy.version(4).stores({ extra: '++id' }).upgrade(() => { throw new Error('simulated bad migration') })
    await expect(buggy.open()).rejects.toThrow()
    buggy.close()

    const again = releasedDb(name)
    await again.open()
    expect((await again.table('workouts').toArray()).map((w) => w.name)).toEqual(['Keep me'])
    again.close()
  })
})

describe('automatic restore points (a second copy in a separate database)', () => {
  async function seeded() {
    const main = new LiftLogDB(uniq('main'))
    await importStrongCsv(fixture, 'lb', main)
    return { main, safety: new SafetyDB(uniq('safety')) }
  }

  it('saves a restore point once a day and skips if one is recent', async () => {
    const { main, safety } = await seeded()
    expect(await maybeAutoRestorePoint(main, safety, 1_000_000)).not.toBeNull()
    expect(await maybeAutoRestorePoint(main, safety, 1_000_000 + 3600_000)).toBeNull()
    expect(await maybeAutoRestorePoint(main, safety, 1_000_000 + AUTO_INTERVAL_MS + 1)).not.toBeNull()
    expect(await safety.points.count()).toBe(2)
  })
  it('does not save an empty database', async () => {
    const safety = new SafetyDB(uniq('safety'))
    expect(await saveRestorePoint('auto', new LiftLogDB(uniq('empty')), safety)).toBeNull()
  })
  it('keeps only the newest few', async () => {
    const { main, safety } = await seeded()
    for (let i = 0; i < KEEP_POINTS + 3; i++) await saveRestorePoint('auto', main, safety, 1000 + i)
    const list = await listRestorePoints(safety)
    expect(list).toHaveLength(KEEP_POINTS)
    expect(list[0].at).toBe(1000 + KEEP_POINTS + 2)
  })
  it('restores a point over damaged data, and saves the damaged state first so even that is undoable', async () => {
    const { main, safety } = await seeded()
    const good = (await saveRestorePoint('auto', main, safety, 5000))!
    const goodSets = await main.sets.count()
    await main.sets.clear() // simulate part of the data being lost (workouts remain, sets gone)
    expect(await main.sets.count()).toBe(0)

    expect(await restoreFromPoint(good.id, main, safety, 6000)).toBe(true)
    expect(await main.sets.count()).toBe(goodSets)
    const pts = await listRestorePoints(safety)
    expect(pts.map((p) => p.reason)).toContain('before-restore')
  })
  it('a restore point is a normal backup file (also usable with Restore from backup)', async () => {
    const { main, safety } = await seeded()
    const p = (await saveRestorePoint('manual', main, safety))!
    const parsed = parseBackup(p.json)
    expect(parsed.ok).toBe(true)
    const other = new LiftLogDB(uniq('other'))
    if (parsed.ok) await restoreBackup(parsed.file, other)
    expect(await other.sets.count()).toBe(await main.sets.count())
    expect((await createBackup(other)).tables.workouts).toEqual((await createBackup(main)).tables.workouts)
  })
})
