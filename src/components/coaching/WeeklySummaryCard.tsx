import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { History } from '../../coaching/types'
import { weeklySummary } from '../../coaching/summary'
import { fmtSets } from '../../coaching/volume'
import { MUSCLE_LABELS, type Settings } from '../../types'

const lc = (s: string) => s.toLowerCase()
const range = (ws: number) => {
  const a = new Date(ws), b = new Date(ws); b.setDate(b.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${f(a)} – ${f(b)}`
}

/** Sessions, hard sets, muscles in/under range, PRs and stalled lifts for one week. */
export default function WeeklySummaryCard({ h, settings, weekStart, now, title }: { h: History; settings: Settings; weekStart: number; now: number; title: string }) {
  const s = useMemo(() => weeklySummary(h, weekStart, settings.weeklyTargets, now), [h, weekStart, settings.weeklyTargets, now])
  const stat = (v: number, l: string) => (
    <div className="flex-1 rounded-xl bg-card2 px-2 py-2.5 text-center"><div className="num text-xl font-bold">{v}</div><div className="text-[11px] text-mute">{l}</div></div>
  )
  return (
    <section className="card space-y-3">
      <div className="flex items-baseline justify-between"><span className="text-lg font-bold">{title}</span><span className="text-xs text-mute">{range(weekStart)}</span></div>
      <div className="flex gap-2">{stat(s.sessions, 'sessions')}{stat(s.hardSets, 'hard sets')}{stat(s.prs, 'PRs')}{stat(s.stalled.length, 'stalled')}</div>
      <div className="space-y-1.5 text-sm">
        <div><span className="font-semibold text-good">In range ({s.inRange.length}): </span><span className="text-mute">{s.inRange.map((m) => lc(MUSCLE_LABELS[m])).join(', ') || 'none yet'}</span></div>
        <div><span className="font-semibold text-warn">Under ({s.under.length}): </span><span className="text-mute">{s.under.map((u) => `${lc(MUSCLE_LABELS[u.muscle])} ${fmtSets(u.current)}/${u.min}`).join(', ') || 'none'}</span></div>
        {s.over.length > 0 && <div><span className="font-semibold text-red-400">Over ({s.over.length}): </span><span className="text-mute">{s.over.map((m) => lc(MUSCLE_LABELS[m])).join(', ')}</span></div>}
        {s.stalled.length > 0 && (
          <div><span className="font-semibold">Stalled: </span>
            {s.stalled.map((id, i) => {
              const e = h.exercises.get(id)
              return <span key={id}>{i > 0 && ', '}<Link className="text-accent" to={`/exercise/${encodeURIComponent(e?.nameKey ?? '')}`}>{e?.name}</Link></span>
            })}
          </div>
        )}
      </div>
    </section>
  )
}
