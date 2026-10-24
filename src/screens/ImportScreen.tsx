import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BackBar, Title } from '../components/PageHeader'
import { setSetting } from '../db/settings'
import { commitWorkoutImport, describeParse, type ImportSummary } from '../import/importer'
import { parseStrongWorkouts, type ParseResult } from '../import/strong'
import type { Unit } from '../types'

const fmt = (t: number | null) => (t ? new Date(t).toLocaleDateString() : '–')

export default function ImportScreen() {
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function pickWorkouts(f: File | undefined) {
    if (!f) return
    setSummary(null)
    setMsg('')
    const p = parseStrongWorkouts(await f.text())
    if (!p.workouts.length) setMsg('No workouts found. Is this the Strong workout export?')
    setParsed(p.workouts.length ? p : null)
  }

  async function run() {
    if (!parsed || !unit) return
    setBusy(true)
    try {
      setSummary(await commitWorkoutImport(parsed, unit))
      await setSetting('units', unit)
      setParsed(null)
    } finally {
      setBusy(false)
    }
  }

  const info = parsed && describeParse(parsed)

  return (
    <div className="space-y-4">
      <BackBar />
      <Title>Import from Strong</Title>
      <div className="card space-y-3">
        <div className="font-medium">1. Choose your workouts CSV</div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => pickWorkouts(e.target.files?.[0])} />
      </div>

      {parsed && info && (
        <div className="card space-y-3">
          <div className="font-medium">2. Check and confirm</div>
          <div className="text-sm text-mute">
            {info.workouts} workouts · {info.sets} sets · {info.exercises} exercises · {fmt(info.firstDate)} to {fmt(info.lastDate)}
            <br />
            {parsed.skipped.length} rows will be skipped (rest timers, empty sets).
          </div>
          <div className="font-medium">Were your Strong weights in lb or kg?</div>
          <div className="flex gap-2">
            {(['lb', 'kg'] as const).map((u) => (
              <button key={u} className={`btn flex-1 ${unit === u ? 'btn-primary' : ''}`} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
          <button className="btn btn-primary w-full disabled:opacity-40" disabled={!unit || busy} onClick={run}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}

      {summary && (
        <div className="card space-y-2">
          <div className="font-medium">Import complete</div>
          <ul className="text-sm">
            <li>{summary.workoutsAdded} workouts added ({summary.workoutsExisting} already there)</li>
            <li>{summary.setsAdded} sets added ({summary.setsDuplicate} duplicates ignored)</li>
            <li>{fmt(summary.firstDate)} to {fmt(summary.lastDate)}</li>
            <li>{summary.exercisesTotal} exercises ({summary.exercisesAdded} new)</li>
            <li>{summary.needingTags} need muscle tags</li>
            <li>{summary.skipped.length} rows skipped</li>
          </ul>
          {summary.warnings.map((w) => <p key={w} className="text-sm text-warn">{w}</p>)}
          {summary.skipped.length > 0 && (
            <details className="text-sm text-mute">
              <summary>Skipped rows</summary>
              <ul className="max-h-40 overflow-auto">
                {Object.entries(summary.skipped.reduce<Record<string, number>>((a, s) => ({ ...a, [s.reason]: (a[s.reason] ?? 0) + 1 }), {})).map(([r, n]) => (
                  <li key={r}>{n} × {r}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex gap-2">
            {summary.needingTags > 0 && <Link to="/tags" className="btn btn-primary flex flex-1 items-center justify-center">Review tags</Link>}
            <Link to="/history" className="btn flex flex-1 items-center justify-center">View history</Link>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-mute">{msg}</p>}
    </div>
  )
}
