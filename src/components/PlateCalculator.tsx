import { useMemo, useState } from 'react'
import { useSettings } from '../db/settings'
import { platesFor } from '../lib/plates'
import { fromKg } from '../units'

const SHADES = ['#2b6cff', '#1fa971', '#e0a100', '#e0562a', '#8a5cf6', '#14a3b8', '#d6409f', '#6b7280']

/** Plates per side for a target weight, drawn as a barbell so you can match it by eye at the rack. */
export default function PlateCalculator({ initialKg }: { initialKg?: number | null }) {
  const { units, barWeight, plates } = useSettings()
  const startVal = initialKg ? String(Math.round(fromKg(initialKg, units) * 100) / 100) : ''
  const [target, setTarget] = useState(startVal)
  const [bar, setBar] = useState<string | null>(null)
  const barVal = bar ?? String(barWeight[units])
  const t = parseFloat(target.replace(',', '.'))
  const b = parseFloat(barVal.replace(',', '.'))
  const avail = plates[units]

  const res = useMemo(() => (t > 0 && b >= 0 ? platesFor(t, b, avail) : null), [t, b, avail])
  const sorted = [...avail].sort((x, y) => y - x)
  const maxP = sorted[0] ?? 1
  const shade = (p: number) => SHADES[Math.max(0, sorted.indexOf(p)) % SHADES.length]
  const flat = res ? res.perSide.flatMap((x) => Array(x.count).fill(x.plate) as number[]) : []

  const field = 'num h-14 w-full rounded-xl bg-card2 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-accent'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <label>
          <div className="label mb-1 text-center">Target ({units})</div>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} onFocus={(e) => e.target.select()} placeholder="135" className={field} />
        </label>
        <label>
          <div className="label mb-1 text-center">Bar ({units})</div>
          <input inputMode="decimal" value={barVal} onChange={(e) => setBar(e.target.value)} onFocus={(e) => e.target.select()} className={field} />
        </label>
      </div>

      {res && t > b && (
        <>
          <div className="flex h-36 items-center justify-center rounded-2xl bg-card2 px-3">
            <div className="h-3 w-8 rounded-l bg-mute/50" />
            <div className="flex h-full items-center gap-[3px]">
              {[...flat].reverse().map((p, i) => (
                <div key={`l${i}`} className="flex items-center justify-center rounded-md text-[11px] font-bold text-white"
                  style={{ height: `${40 + (p / maxP) * 60}%`, width: 20, background: shade(p) }}>{p}</div>
              ))}
            </div>
            <div className="h-3 flex-1 bg-mute/50" style={{ minWidth: 24 }} />
            <div className="flex h-full items-center gap-[3px]">
              {flat.map((p, i) => (
                <div key={`r${i}`} className="flex items-center justify-center rounded-md text-[11px] font-bold text-white"
                  style={{ height: `${40 + (p / maxP) * 60}%`, width: 20, background: shade(p) }}>{p}</div>
              ))}
            </div>
            <div className="h-3 w-8 rounded-r bg-mute/50" />
          </div>

          <div className="card !bg-card2">
            <div className="label mb-2">Each side</div>
            {res.perSide.length ? (
              <div className="space-y-1">
                {res.perSide.map((x) => (
                  <div key={x.plate} className="num flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: shade(x.plate) }} />{x.plate} {units}</span>
                    <span className="font-bold">× {x.count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-mute">Just the bar.</div>}
          </div>

          {res.diff !== 0 && (
            <div className="rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
              {t < b ? `Lighter than the bar (${b} ${units}).` : `Can't load exactly ${t} ${units} with your plates. Closest is ${res.achieved} ${units} (${Math.abs(res.diff)} ${units} ${res.diff < 0 ? 'under' : 'over'}).`}
            </div>
          )}
        </>
      )}
      {t > 0 && t <= b && <div className="text-center text-mute">That's just the bar{t < b ? ' (or less)' : ''}.</div>}
      {!(t > 0) && <div className="text-center text-mute">Enter a target weight.</div>}
      <p className="text-center text-xs text-mute">Change your bar and available plates in Settings.</p>
    </div>
  )
}
