import { db as defaultDb, SCHEMA_VERSION, type LiftLogDB, type SettingRow } from '../db/db'
import type { Exercise, Routine, Workout, WorkoutSet } from '../types'

export const BACKUP_FORMAT = 'liftlog-backup'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  /** epoch ms */
  exportedAt: number
  tables: {
    exercises: Exercise[]
    routines: Routine[]
    workouts: Workout[]
    sets: WorkoutSet[]
    settings: SettingRow[]
  }
}

export interface BackupSummary {
  exercises: number
  routines: number
  workouts: number
  sets: number
  firstDate: number | null
  lastDate: number | null
}

/** Everything that matters, in one object. The workout in progress is deliberately not included. */
export async function createBackup(d: LiftLogDB = defaultDb, now = Date.now()): Promise<BackupFile> {
  const [exercises, routines, workouts, sets, settings] = await Promise.all([
    d.exercises.toArray(), d.routines.toArray(), d.workouts.toArray(), d.sets.toArray(), d.settings.toArray(),
  ])
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables: { exercises, routines, workouts, sets, settings } }
}

export function summarize(t: BackupFile['tables']): BackupSummary {
  const dates = t.workouts.map((w) => w.startedAt)
  return {
    exercises: t.exercises.length, routines: t.routines.length, workouts: t.workouts.length, sets: t.sets.length,
    firstDate: dates.length ? Math.min(...dates) : null, lastDate: dates.length ? Math.max(...dates) : null,
  }
}

export type ParsedBackup =
  | { ok: true; file: BackupFile; summary: BackupSummary; warnings: string[] }
  | { ok: false; error: string }

const isArr = (v: unknown): v is unknown[] => Array.isArray(v)

/**
 * Reads and validates a backup file's text. Older schema versions are accepted (and upgraded here when
 * the shape changes); files from a newer app version are refused rather than half-restored.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'That file isn’t a valid backup (it isn’t readable JSON).' } }
  const f = raw as Partial<BackupFile> | null
  if (!f || f.format !== BACKUP_FORMAT) return { ok: false, error: 'That doesn’t look like a LiftLog backup file.' }
  if (typeof f.schemaVersion !== 'number') return { ok: false, error: 'The backup has no version number, so it can’t be restored safely.' }
  if (f.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'This backup was made by a newer version of LiftLog. Update the app first, then restore.' }
  const t = f.tables
  if (!t || !isArr(t.exercises) || !isArr(t.routines) || !isArr(t.workouts) || !isArr(t.sets)) return { ok: false, error: 'The backup is missing data tables.' }

  // Upgrade hook: v1 -> v3 files only differ by tables we no longer use (e.g. measurements), which are ignored.
  const warnings: string[] = []
  const exIds = new Set((t.exercises as Exercise[]).map((e) => e.id))
  const wkIds = new Set((t.workouts as Workout[]).map((w) => w.id))
  const sets = (t.sets as WorkoutSet[]).filter((s) => exIds.has(s.exerciseId) && wkIds.has(s.workoutId))
  if (sets.length !== t.sets.length) warnings.push(`${t.sets.length - sets.length} sets pointed at missing workouts or exercises and will be skipped.`)

  const tables: BackupFile['tables'] = {
    exercises: t.exercises as Exercise[], routines: t.routines as Routine[], workouts: t.workouts as Workout[], sets,
    settings: isArr(t.settings) ? (t.settings as SettingRow[]) : [],
  }
  return {
    ok: true, warnings, summary: summarize(tables),
    file: { format: BACKUP_FORMAT, schemaVersion: f.schemaVersion, exportedAt: typeof f.exportedAt === 'number' ? f.exportedAt : 0, tables },
  }
}

/** Replaces all data with the backup's, keeping ids so routines and sets still point at the right rows. */
export async function restoreBackup(file: BackupFile, d: LiftLogDB = defaultDb): Promise<void> {
  const { exercises, routines, workouts, sets, settings } = file.tables
  await d.transaction('rw', [d.exercises, d.routines, d.workouts, d.sets, d.settings, d.active], async () => {
    await Promise.all([d.exercises.clear(), d.routines.clear(), d.workouts.clear(), d.sets.clear(), d.settings.clear(), d.active.clear()])
    await d.exercises.bulkAdd(exercises)
    await d.routines.bulkAdd(routines)
    await d.workouts.bulkAdd(workouts)
    await d.sets.bulkAdd(sets)
    await d.settings.bulkPut(settings)
    if (file.exportedAt) await d.settings.put({ key: 'lastBackupAt', value: file.exportedAt })
  })
}

export const backupFilename = (now = Date.now()) => `liftlog-backup-${new Date(now).toISOString().slice(0, 10)}.json`

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** iOS share sheet when the browser can share files (Save to Files, AirDrop, Messages…), else a normal download. */
export async function shareOrDownload(filename: string, text: string, mime: string): Promise<ShareResult> {
  const file = new File([text], filename, { type: mime })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // Any other share failure falls through to a download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export const BACKUP_REMINDER_DAYS = 14

/** True when it has been 14+ days since the last backup (or since install, if never backed up). */
export function backupDue(lastBackupAt: number | null, installedAt: number | null, now: number, hasData: boolean): boolean {
  if (!hasData) return false
  const since = lastBackupAt ?? installedAt
  return since !== null && now - since >= BACKUP_REMINDER_DAYS * 86_400_000
}
