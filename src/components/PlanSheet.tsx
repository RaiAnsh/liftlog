import { useMemo, useRef, useState } from 'react'
import { goalLabel } from '../coaching/goals'
import { buildPlan, DAY_LONG, DAY_SHORT, WEEK_ORDER } from '../coaching/plan'
import { normName } from '../data/inferTemplates'
import { applySplit, exampleById, splitFor, splitKindFor } from '../data/splits'
import { setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'
import type { Routine } from '../types'
import Sheet from './Sheet'

type Mode = 'suggested' | 'mine'

/**
 * "Plan your week": pick the days you're free and get a split that fits how many days you train and what you're
 * building (Push/Pull/Legs for 3 days, something different for 4, 5, 6 or 7, with glute-focused versions).
 * Templates you don't have yet are added; ones you already have (same name) are reused. Or use only your own templates.
 */
export default function PlanSheet({ routines, onClose }: { routines: Routine[]; onClose: () => void }) {
  const { plan: saved, planDays, program, goal, units } = useSettings()
  const [days, setDays] = useState<number[]>(planDays.length ? planDays : [1, 3, 5])
  const daysRef = useRef(days) // always the latest choice, even for rapid taps
  const [mode, setMode] = useState<Mode>('suggested')
  const [mine, setMine] = useState<(number | null)[]>(saved ?? buildPlan(planDays.length ? planDays : [1, 3, 5], routines, program))
  const [busy, setBusy] = useState(false)

  const kind = splitKindFor(goal)
  const split = splitFor(days.length, kind)
  const ordered = WEEK_ORDER.filter((d) => days.includes(d))
  const have = useMemo(() => new Set(routines.map((r) => normName(r.name))), [routines])

  const toggle = (d: number) => {
    const cur = daysRef.current
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    daysRef.current = next
    setDays(next)
    setMine(buildPlan(next, routines, program))
  }
  const assigned = mode === 'suggested' ? ordered.length : mine.filter((x) => x !== null).length

  async function save() {
    setBusy(true)
    if (mode === 'suggested' && split) {
      const { plan, created } = await applySplit(days, split, units)
      await setSetting('plan', plan)
      await setSetting('planDays', WEEK_ORDER.filter((d) => plan[d] !== null))
      showToast('Week planned', { sub: created.length ? `Added ${created.join(', ')}. Edit any day from “Your week”.` : `${assigned} training days, using your templates.` })
    } else {
      await setSetting('plan', mine)
      await setSetting('planDays', WEEK_ORDER.filter((d) => mine[d] !== null))
      showToast('Week planned', { sub: `${assigned} training day${assigned === 1 ? '' : 's'}. “Up next” will follow it.` })
    }
    onClose()
  }
  async function clear() {
    await setSetting('plan', null)
    await setSetting('planDays', [])
    onClose()
  }

  return (
    <Sheet title="Plan your week" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="label mb-2">Which days are you free to train?</div>
          <div className="grid grid-cols-7 gap-1">
            {WEEK_ORDER.map((d) => (
              <button key={d} onClick={() => toggle(d)} aria-pressed={days.includes(d)}
                className={`press rounded-xl py-2.5 text-sm font-bold transition-colors ${days.includes(d) ? 'bg-accent text-white' : 'bg-card2 text-mute'}`}>{DAY_SHORT[d].slice(0, 2)}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-card2 p-1">
          {([['suggested', 'Suggested for you'], ['mine', 'My templates']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-lg py-2 text-sm font-bold transition-colors ${mode === k ? 'bg-accent text-white' : 'text-mute'}`}>{l}</button>
          ))}
        </div>

        {mode === 'suggested' ? (
          days.length === 0 || !split ? (
            <p className="py-4 text-center text-mute">Pick at least one day.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-accent/10 px-3 py-2.5">
                <div className="font-bold">{days.length} day{days.length === 1 ? '' : 's'} · {split.label}</div>
                <div className="mt-0.5 text-sm text-mute">{split.note}{goal && <> Tuned for your <b className="text-fg">{goalLabel(goal)}</b> goal.</>}</div>
              </div>
              <div className="space-y-1.5">
                {ordered.map((d, i) => {
                  const tpl = exampleById(split.ids[i])!
                  const yours = have.has(normName(tpl.name))
                  return (
                    <div key={d} className="rise flex items-center gap-3 rounded-xl bg-card2 px-3 py-2.5" style={{ ['--i' as string]: i }}>
                      <span className="w-12 shrink-0 text-sm font-bold text-accent">{DAY_SHORT[d]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{tpl.name}</div>
                        <div className="truncate text-xs text-mute">{tpl.blurb}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${yours ? 'bg-good/15 text-good' : 'bg-card text-mute'}`}>{yours ? 'yours' : 'new'}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-mute">“New” workouts are added to your templates. Anything you already have with the same name is used as-is. You can edit every template afterwards.</p>
            </div>
          )
        ) : routines.length === 0 ? (
          <p className="py-4 text-center text-mute">You don’t have any templates yet. Use “Suggested for you”, or add one from the Workout tab first.</p>
        ) : (
          <div className="space-y-1.5">
            {WEEK_ORDER.map((d) => (
              <label key={d} className="flex items-center gap-3">
                <span className={`w-24 shrink-0 text-sm font-semibold ${mine[d] !== null ? '' : 'text-mute'}`}>{DAY_LONG[d]}</span>
                <select value={mine[d] ?? ''} onChange={(e) => { const v = e.target.value; const n = [...mine]; n[d] = v === '' ? null : Number(v); setMine(n); const nd = WEEK_ORDER.filter((x) => n[x] !== null); daysRef.current = nd; setDays(nd) }}
                  className="min-w-0 flex-1 rounded-xl bg-card2 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-accent">
                  <option value="">Rest</option>
                  {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button className="btn btn-primary press disabled:opacity-40" disabled={assigned === 0 || busy} onClick={save}>Save plan</button>
          {saved && <button className="btn press px-5" onClick={clear}>Clear</button>}
        </div>
      </div>
    </Sheet>
  )
}
