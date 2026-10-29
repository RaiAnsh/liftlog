import Dexie, { type Table } from 'dexie'
import { db as mainDb, type LiftLogDB } from '../db/db'
import { createBackup, parseBackup, restoreBackup, summarize, type BackupSummary } from './backup'

export interface RestorePoint {
  id: string
  /** epoch ms */
  at: number
  reason: 'auto' | 'before-restore' | 'manual'
  schemaVersion: number
  summary: BackupSummary
  /** the full backup file as JSON text */
  json: string
}

/**
 * A second database, separate from the main one, that keeps the last few automatic copies of your data.
 * It protects against bugs (a bad update, a bad migration, an accidental restore) but NOT against iOS
 * clearing all of this site's storage, which would take both databases. Exported backup files cover that.
 */
class SafetyDB extends Dexie {
  points!: Table<RestorePoint, string>
  constructor(name = 'liftlog-safety') {
    super(name)
    this.version(1).stores({ points: 'id, at' })
  }
}
export const safetyDb = new SafetyDB()

export const KEEP_POINTS = 3
export const AUTO_INTERVAL_MS = 20 * 3600_000

export async function saveRestorePoint(reason: RestorePoint['reason'], main: LiftLogDB = mainDb, safety: SafetyDB = safetyDb, now = Date.now()): Promise<RestorePoint | null> {
  const file = await createBackup(main, now)
  const summary = summarize(file.tables)
  if (!summary.workouts && !summary.routines) return null // nothing worth saving
  const point: RestorePoint = { id: `rp-${now}`, at: now, reason, schemaVersion: file.schemaVersion, summary, json: JSON.stringify(file) }
  await safety.transaction('rw', safety.points, async () => {
    await safety.points.put(point)
    const all = await safety.points.orderBy('at').reverse().toArray()
    // Keep the newest few, but never let "before-restore" copies push out every automatic one.
    for (const old of all.slice(KEEP_POINTS)) await safety.points.delete(old.id)
  })
  return point
}

/** Called at app start: saves a restore point if the newest one is over ~a day old (or there is none). */
export async function maybeAutoRestorePoint(main: LiftLogDB = mainDb, safety: SafetyDB = safetyDb, now = Date.now()): Promise<RestorePoint | null> {
  const newest = await safety.points.orderBy('at').last()
  if (newest && now - newest.at < AUTO_INTERVAL_MS) return null
  return saveRestorePoint('auto', main, safety, now)
}

export const listRestorePoints = (safety: SafetyDB = safetyDb) => safety.points.orderBy('at').reverse().toArray()

/** Restores a point over the main database. The current data is itself saved as a restore point first. */
export async function restoreFromPoint(id: string, main: LiftLogDB = mainDb, safety: SafetyDB = safetyDb, now = Date.now()): Promise<boolean> {
  const p = await safety.points.get(id)
  if (!p) return false
  const parsed = parseBackup(p.json)
  if (!parsed.ok) return false
  await saveRestorePoint('before-restore', main, safety, now)
  await restoreBackup(parsed.file, main)
  return true
}

export { SafetyDB }
