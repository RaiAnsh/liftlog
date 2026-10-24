import { useMemo, useState } from 'react'
import { useSettings } from '../db/settings'
import { platesFor, smallestStep } from '../lib/plates'
import { warmupSets } from '../lib/warmup'
import { formatWeight, fromKg, toKg } from '../units'
import type { Exercise } from '../types'
import Sheet from './Sheet'

/** Preview and insert ramp-up sets: bar x10, then 40 / 60 / 80% of the working weight. */
export default function WarmupSheet({ ex, initialKg, onAdd, onClose }: {
  ex: Exercise | undefined; initialKg: number | null; onAdd: (s: { weightKg: number; reps: number }[]) => void; onClose: () => void
}) {
  const { units, barWeight, plates } = useSettings()
  const [text, setText] = useState(initialKg ? String(Math.round(fromKg(initialKg, units) * 100) / 100) : '')
  const useBar = ex?.equipment === 'barbell'
  const stepKg = useBar ? toKg(smallestStep(plates[units]), units) : (ex?.weightIncrement ?? toKg(5, units))
  const working = parseFloat(text.replace(',', '.'))
  const sets = useMemo(
    () => warmupSets({ workingKg: working > 0 ? toKg(working, units) : 0, barKg: toKg(barWeight[units], units), stepKg, useBar }),
    [working, units, barWeight, stepKg, useBar],
  )

  return (
    <Sheet title="Warm-up sets" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <div className="label mb-1">First working weight ({units})</div>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()} placeholder="135"
            className="num h-14 w-full rounded-xl bg-card2 text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-accent" />
        </label>
        {sets.length > 0 ? (
          <div className="space-y-1">
            {sets.map((s, i) => {
              const side = useBar ? platesFor(fromKg(s.weightKg, units), barWeight[units], plates[units]).perSide : []
              return (
                <div key={i} className="num flex items-center justify-between rounded-xl bg-card2 px-3 py-2.5">
                  <span className="text-lg font-bold">{formatWeight(s.weightKg, units)} {units} × {s.reps}</span>
                  <span className="text-sm text-mute">{useBar ? (side.length ? side.map((x) => `${x.count}×${x.plate}`).join(' + ') : 'bar') : ''}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-card2 p-3 text-center text-mute">{working > 0 ? 'Weight is too light to need a warm-up.' : 'Enter your first working weight.'}</div>
        )}
        <button className="btn btn-primary w-full disabled:opacity-40" disabled={!sets.length} onClick={() => onAdd(sets)}>
          Add {sets.length || ''} warm-up set{sets.length === 1 ? '' : 's'}
        </button>
        <p className="text-center text-xs text-mute">{useBar ? 'Loadable with your plates and bar from Settings.' : 'Rounded to this exercise’s weight steps.'}</p>
      </div>
    </Sheet>
  )
}
