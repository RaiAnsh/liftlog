import { useState } from 'react'
import { buildPlan, DAY_LONG, DAY_SHORT, WEEK_ORDER } from '../coaching/plan'
import { setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'
import type { Routine } from '../types'
import Sheet from './Sheet'

/**
 * "Plan your week": pick the days you're free and LiftLog assigns your templates to them in rotation order
 * (Monday Push, Wednesday Pull...). Change any day, or leave it as a rest day. "Up next" then follows the plan.
 */
export default function PlanSheet({ routines, onClose }: { routines: Routine[]; onClose: () => void }) {
  const { plan: saved, planDays, program } = useSettings()
  const [days, setDays] = useState<number[]>(planDays.length ? planDays : [1, 3, 5])
  const [plan, setPlan] = useState<(number | null)[]>(saved ?? buildPlan(planDays.length ? planDays : [1, 3, 5], routines, program))

  // Choosing days re-suggests the whole week; edit individual days afterwards.
  const toggle = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    setDays(next)
    setPlan(buildPlan(next, routines, program))
  }
  const assigned = plan.filter((x) => x !== null).length

  async function save() {
    await setSetting('plan', plan)
    await setSetting('planDays', WEEK_ORDER.filter((d) => plan[d] !== null))
    showToast('Week planned', { sub: `${assigned} training day${assigned === 1 ? '' : 's'}. “Up next” will follow it.` })
    onClose()
  }
  async function clear() {
    await setSetting('plan', null)
    await setSetting('planDays', [])
    onClose()
  }

  return (
    <Sheet title="Plan your week" onClose={onClose}>
      {routines.length === 0 ? (
        <p className="py-6 text-center text-mute">Add a template first (Workout tab → example templates), then plan which day each one goes on.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Which days are you free to train?</div>
            <div className="grid grid-cols-7 gap-1">
              {WEEK_ORDER.map((d) => (
                <button key={d} onClick={() => toggle(d)} aria-pressed={days.includes(d)}
                  className={`press rounded-xl py-2.5 text-sm font-bold transition-colors ${days.includes(d) ? 'bg-accent text-white' : 'bg-card2 text-mute'}`}>{DAY_SHORT[d].slice(0, 2)}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-mute">I’ll suggest a workout for each day, in your template order. Change any of them below.</p>
          </div>

          <div className="space-y-1.5">
            {WEEK_ORDER.map((d) => (
              <label key={d} className="flex items-center gap-3">
                <span className={`w-24 shrink-0 text-sm font-semibold ${plan[d] !== null ? '' : 'text-mute'}`}>{DAY_LONG[d]}</span>
                <select value={plan[d] ?? ''} onChange={(e) => { const v = e.target.value; const n = [...plan]; n[d] = v === '' ? null : Number(v); setPlan(n); setDays(WEEK_ORDER.filter((x) => n[x] !== null)) }}
                  className="min-w-0 flex-1 rounded-xl bg-card2 px-3 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-accent">
                  <option value="">Rest</option>
                  {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button className="btn btn-primary press disabled:opacity-40" disabled={assigned === 0} onClick={save}>Save plan</button>
            {saved && <button className="btn press px-5" onClick={clear}>Clear</button>}
          </div>
        </div>
      )}
    </Sheet>
  )
}
