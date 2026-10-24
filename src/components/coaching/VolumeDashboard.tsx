import { useState } from 'react'
import Sheet from '../Sheet'
import { setSetting } from '../../db/settings'
import { DEFAULT_RANGE, fmtSets, rangeFor, statusOf, type MuscleCounts, type Status } from '../../coaching/volume'
import { MUSCLES, MUSCLE_LABELS, type Muscle, type Settings } from '../../types'

const COLOR: Record<Status, { bar: string; text: string; label: string }> = {
  under: { bar: 'bg-warn', text: 'text-warn', label: 'Under' },
  in: { bar: 'bg-good', text: 'text-good', label: 'In range' },
  over: { bar: 'bg-red-500', text: 'text-red-400', label: 'Over' },
}

function Trend({ weeks, muscle, scale }: { weeks: { weekStart: number; counts: MuscleCounts }[]; muscle: Muscle; scale: number }) {
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-label="Last 4 weeks">
      {weeks.map((w, i) => {
        const v = w.counts[muscle]
        const last = i === weeks.length - 1
        return <div key={w.weekStart} className={`w-2.5 rounded-sm ${last ? 'bg-accent' : 'bg-mute/40'}`} style={{ height: `${Math.max(6, Math.min(100, (v / scale) * 100))}%` }} title={`${fmtSets(v)} sets`} />
      })}
    </div>
  )
}

function TargetSheet({ muscle, settings, onClose }: { muscle: Muscle; settings: Settings; onClose: () => void }) {
  const r = rangeFor(muscle, settings.weeklyTargets)
  const set = (min: number, max: number) => setSetting('weeklyTargets', { ...settings.weeklyTargets, [muscle]: { min: Math.max(0, min), max: Math.max(Math.max(0, min), max) } })
  const Step = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="label">{label}</div>
      <div className="flex items-center gap-3">
        <button className="btn !min-h-[44px] w-11 !px-0 text-xl" onClick={() => onChange(value - 1)}>−</button>
        <div className="num w-10 text-center text-2xl font-bold">{value}</div>
        <button className="btn !min-h-[44px] w-11 !px-0 text-xl" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
  return (
    <Sheet title={`${MUSCLE_LABELS[muscle]} weekly sets`} onClose={onClose}>
      <p className="mb-4 text-center text-sm text-mute">Hard sets per week: primary muscle counts 1, secondary 0.5. A max of 0 hides this muscle from coaching.</p>
      <div className="mb-4 flex gap-2"><Step label="Min" value={r.min} onChange={(n) => set(n, r.max)} /><Step label="Max" value={r.max} onChange={(n) => set(r.min, n)} /></div>
      <button className="btn w-full" onClick={() => { const { [muscle]: _, ...rest } = settings.weeklyTargets; void _; setSetting('weeklyTargets', rest) }}>
        Reset to default ({DEFAULT_RANGE.min}–{DEFAULT_RANGE.max})
      </button>
    </Sheet>
  )
}

/** This week's hard sets per muscle against your target range, with a 4-week trend. Tap a row to edit its target. */
export default function VolumeDashboard({ counts, breakdown, settings }: {
  counts: MuscleCounts; breakdown: { weekStart: number; counts: MuscleCounts }[]; settings: Settings
}) {
  const [edit, setEdit] = useState<Muscle | null>(null)
  const rows = MUSCLES.map((m) => ({ m, n: counts[m], r: rangeFor(m, settings.weeklyTargets) })).filter((x) => x.r.max > 0)
  const tally = { under: 0, in: 0, over: 0 }
  for (const x of rows) tally[statusOf(x.n, x.r)]++

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="label">Weekly muscle volume</span>
        <span className="text-xs text-mute">hard sets · last 4 weeks →</span>
      </div>
      <div className="flex gap-2 text-xs font-semibold">
        <span className={`chip flex items-center ${COLOR.under.text}`}>{tally.under} under</span>
        <span className={`chip flex items-center ${COLOR.in.text}`}>{tally.in} in range</span>
        <span className={`chip flex items-center ${COLOR.over.text}`}>{tally.over} over</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        {rows.map(({ m, n, r }, i) => {
          const st = statusOf(n, r)
          const scale = Math.max(r.max * 1.3, n, 1)
          return (
            <button key={m} onClick={() => setEdit(m)} className={`row-press flex w-full items-center gap-3 px-3 py-2.5 text-left ${i ? 'border-t border-line' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{MUSCLE_LABELS[m]}</span>
                  <span className={`num text-sm font-bold ${COLOR[st].text}`}>{fmtSets(n)} <span className="font-normal text-mute">/ {r.min}–{r.max}</span></span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-card2">
                  <div className="absolute inset-y-0 bg-mute/25" style={{ left: `${(r.min / scale) * 100}%`, width: `${((r.max - r.min) / scale) * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${COLOR[st].bar}`} style={{ width: `${Math.min(100, (n / scale) * 100)}%` }} />
                </div>
              </div>
              <Trend weeks={breakdown} muscle={m} scale={scale} />
            </button>
          )
        })}
      </div>
      {edit && <TargetSheet muscle={edit} settings={settings} onClose={() => setEdit(null)} />}
    </section>
  )
}
