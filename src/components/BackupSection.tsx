import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import Sheet from './Sheet'
import { backupFilename, createBackup, parseBackup, restoreBackup, shareOrDownload, summarize, type ParsedBackup } from '../backup/backup'
import { listRestorePoints, restoreFromPoint, saveRestorePoint } from '../backup/restorePoint'
import { exportStrongCsv, strongCsvFilename } from '../backup/strongCsv'
import { db } from '../db/db'
import { setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'

const fmtDate = (t: number | null) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '–')
const ago = (t: number) => { const d = Math.floor((Date.now() - t) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago` }

export default function BackupSection() {
  const { lastBackupAt, units } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<(Extract<ParsedBackup, { ok: true }> & { pointId?: string }) | null>(null)
  const points = useLiveQuery(() => listRestorePoints())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const current = useLiveQuery(async () => summarize({ exercises: await db.exercises.toArray(), routines: await db.routines.toArray(), workouts: await db.workouts.toArray(), sets: await db.sets.toArray(), settings: [] }))
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? null)

  async function exportBackup() {
    setBusy(true)
    try {
      const file = await createBackup()
      const res = await shareOrDownload(backupFilename(), JSON.stringify(file), 'application/json')
      if (res !== 'cancelled') {
        await setSetting('lastBackupAt', Date.now())
        showToast(res === 'shared' ? 'Backup ready' : 'Backup downloaded', { sub: 'Keep it somewhere safe, like iCloud Drive.' })
      }
    } finally { setBusy(false) }
  }

  async function exportCsv() {
    const [workouts, sets, exercises] = await Promise.all([db.workouts.toArray(), db.sets.toArray(), db.exercises.toArray()])
    const csv = exportStrongCsv(workouts, sets, new Map(exercises.map((e) => [e.id!, e])), units)
    const res = await shareOrDownload(strongCsvFilename(units), csv, 'text/csv')
    if (res !== 'cancelled') showToast('CSV exported', { sub: `Weights are in ${units}.` })
  }

  async function pick(f: File | undefined) {
    if (!f) return
    setError('')
    const r = parseBackup(await f.text())
    if (r.ok) setPending(r)
    else setError(r.error)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function confirmRestore() {
    if (!pending) return
    setBusy(true)
    // Whatever you restore over is saved as a restore point first, so a restore can itself be undone.
    if (pending.pointId) await restoreFromPoint(pending.pointId)
    else { await saveRestorePoint('before-restore'); await restoreBackup(pending.file) }
    location.reload() // the workout in progress and all cached state were replaced; start clean
  }

  const row = (l: string, v: string | number) => <div className="flex justify-between py-1"><span className="text-mute">{l}</span><span className="num font-semibold">{v}</span></div>

  return (
    <section className="space-y-2">
      <div className="label px-1">Backup &amp; restore</div>
      <div className="card space-y-3">
        <div className="text-sm text-mute">
          {lastBackupAt ? <>Last backup: <b className="text-fg">{fmtDate(lastBackupAt)}</b> ({ago(lastBackupAt)})</> : 'No backup yet.'} Your data lives only on this phone, so back up now and then.
        </div>
        <button className="btn btn-primary w-full disabled:opacity-50" disabled={busy} onClick={exportBackup}>Export backup</button>
        <button className="btn w-full" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {error && <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button className="btn w-full" onClick={exportCsv}>Export workouts as Strong CSV</button>
        {persisted !== undefined && persisted !== null && (
          <div className={`text-xs ${persisted ? 'text-good' : 'text-mute'}`}>
            {persisted ? '✓ Storage is marked persistent, so iOS won’t clear it to free space.' : 'Storage isn’t marked persistent. Installing to the Home Screen helps keep your data safe.'}
          </div>
        )}
      </div>

      {points && points.length > 0 && (
        <div className="card space-y-2">
          <div className="font-semibold">Automatic restore points</div>
          <p className="text-xs text-mute">ARLog quietly keeps a copy once a day (and before any restore). They guard against app mistakes and bad updates. They live on this phone, so exported backups are still your real safety net.</p>
          {points.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-card2 px-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{new Date(p.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{p.reason === 'before-restore' ? ' · before a restore' : ''}</div>
                <div className="text-xs text-mute">{p.summary.workouts} workouts · {p.summary.sets} sets</div>
              </div>
              <button className="press rounded-lg px-3 py-2 text-sm font-semibold text-accent" onClick={() => { const r = parseBackup(p.json); if (r.ok) setPending({ ...r, pointId: p.id }) }}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {pending && current && (
        <Sheet title="Restore this backup?" onClose={() => setPending(null)}>
          <p className="mb-3 text-center text-sm text-mute">Backup from {pending.file.exportedAt ? fmtDate(pending.file.exportedAt) : 'an unknown date'}. This <b className="text-red-400">replaces everything</b> on this device.</p>
          <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-x-4 rounded-xl bg-card2 p-3 text-sm">
            <span className="label">&nbsp;</span><span className="label text-right">Now</span><span className="label text-right">After</span>
            {([['Workouts', current.workouts, pending.summary.workouts], ['Sets', current.sets, pending.summary.sets], ['Exercises', current.exercises, pending.summary.exercises], ['Routines', current.routines, pending.summary.routines]] as const).map(([l, a, b]) => (
              <div key={l} className="contents"><span className="py-1 text-mute">{l}</span><span className="num py-1 text-right">{a}</span><span className="num py-1 text-right font-bold">{b}</span></div>
            ))}
          </div>
          {row('History from', fmtDate(pending.summary.firstDate))}
          {row('History to', fmtDate(pending.summary.lastDate))}
          {pending.warnings.map((w) => <p key={w} className="mt-2 text-sm text-warn">{w}</p>)}
          <p className="my-3 text-center text-xs text-mute">Tip: export a backup of the current data first if you’re not sure.</p>
          <div className="space-y-2">
            <button className="btn btn-primary w-full disabled:opacity-50" disabled={busy} onClick={confirmRestore}>Replace my data</button>
            <button className="btn w-full" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}
