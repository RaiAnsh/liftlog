import { useState } from 'react'
import MuscleFigure from '../MuscleFigure'
import { AnimatedBar, CountUp } from '../Motion'
import Sheet from '../Sheet'
import { setSetting } from '../../db/settings'
import { DEFAULT_RANGE, fmtSets, LEVEL_LABEL, levelOf, rangeFor, type Level, type MuscleCounts } from '../../coaching/volume'
import { MUSCLES, MUSCLE_LABELS, type Muscle, type Settings } from '../../types'

const LEVEL: Record<Level, { color: string; bar: string; text: string }> = {
  none: { color: 'rgb(var(--mute) / 0.0)', bar: 'bg-mute/40', text: 'text-mute' },
  low: { color: 'rgb(var(--warn))', bar: 'bg-warn', text: 'text-warn' },
  good: { color: 'rgb(var(--good))', bar: 'bg-good', text: 'text-good' },
  high: { color: 'rgb(var(--accent))', bar: 'bg-accent', text: 'text-accent' },
}

const ago = (now: number, t: number | undefined) => {
  if (t === undefined) return 'Never trained'
  const d = Math.floor((now - t) / 86_400_000)
  return d <= 0 ? 'Trained today' : d === 1 ? 'Trained yesterday' : `Trained ${d} days ago`
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
    <Sheet title={MUSCLE_LABELS[muscle]} onClose={onClose}>
      <p className="mb-4 text-center text-sm text-mute">
        “On track” means {r.min} to {r.max} hard sets in a week. Fewer is “Building”, more is “High”. Primary muscle counts 1 set, secondary 0.5. A max of 0 hides this muscle.
      </p>
      <div className="mb-4 flex gap-2"><Step label="On track from" value={r.min} onChange={(n) => set(n, r.max)} /><Step label="Up to" value={r.max} onChange={(n) => set(r.min, n)} /></div>
      <button className="btn w-full" onClick={() => { const { [muscle]: _drop, ...rest } = settings.weeklyTargets; void _drop; setSetting('weeklyTargets', rest) }}>
        Reset to default ({DEFAULT_RANGE.min}–{DEFAULT_RANGE.max})
      </button>
    </Sheet>
  )
}

/**
 * This week's muscle work as a colour-coded body map plus plain-language rows ("Building", "On track"),
 * each compared with your own usual week. The numeric target only appears when you tap a muscle to edit it.
 */
export default function VolumeDashboard({ counts, breakdown, last, now, settings }: {
  counts: MuscleCounts; breakdown: { weekStart: number; counts: MuscleCounts }[]; last: Map<Muscle, number>; now: number; settings: Settings
}) {
  const [edit, setEdit] = useState<Muscle | null>(null)
  const rows = MUSCLES.map((m) => ({ m, n: counts[m], r: rangeFor(m, settings.weeklyTargets) })).filter((x) => x.r.max > 0)
  const earlier = breakdown.slice(0, -1)
  const usual = (m: Muscle) => (earlier.length ? earlier.reduce((n, w) => n + w.counts[m], 0) / earlier.length : 0)
  const colors: Partial<Record<Muscle, string>> = {}
  for (const { m, n, r } of rows) { const l = levelOf(n, r); if (l !== 'none') colors[m] = LEVEL[l].color }

  return (
    <section className="space-y-3">
      <div className="label">Muscles this week</div>
      <div className="card">
        <div className="grid grid-cols-2 gap-2">
          {(['front', 'back'] as const).map((v) => (
            <div key={v} className="text-center">
              <MuscleFigure view={v} colors={colors} className="mx-auto h-56 w-full" title={`${v} muscle map`} />
              <div className="label mt-1">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-mute">
          {(['low', 'good', 'high'] as const).map((l) => (
            <span key={l} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LEVEL[l].color }} />{LEVEL_LABEL[l]}</span>
          ))}
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-mute/40" />Not yet</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card">
        {rows.map(({ m, n, r }, i) => {
          const lvl = levelOf(n, r)
          const u = usual(m)
          const diff = Math.round(n - u)
          return (
            <button key={m} onClick={() => setEdit(m)} className={`row-press rise flex w-full items-center gap-3 px-4 py-3 text-left ${i ? 'border-t border-line' : ''}`} style={{ ['--i' as string]: Math.min(i, 8) }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{MUSCLE_LABELS[m]}</span>
                  <span className={`text-sm font-bold ${LEVEL[lvl].text}`}>{LEVEL_LABEL[lvl]}</span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-card2">
                  <AnimatedBar pct={(n / r.max) * 100} className={LEVEL[lvl].bar} delay={i * 35} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-mute">
                  <span>{ago(now, last.get(m))}</span>
                  <span className="num">
                    <b className="text-fg"><CountUp value={n} format={(x) => fmtSets(Math.round(x * 2) / 2)} /></b> sets
                    {u >= 1 && Math.abs(diff) >= 1 && <span className={diff > 0 ? 'text-good' : 'text-warn'}> {diff > 0 ? '▲' : '▼'}{Math.abs(diff)} vs usual</span>}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {edit && <TargetSheet muscle={edit} settings={settings} onClose={() => setEdit(null)} />}
    </section>
  )
}
