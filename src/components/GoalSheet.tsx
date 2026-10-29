import { useState } from 'react'
import { GOALS, TIER_HINT, TIER_LABEL, targetsFor } from '../coaching/goals'
import { setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'
import { MUSCLES, MUSCLE_LABELS, type GoalId, type Muscle, type Tier } from '../types'
import MuscleFigure from './MuscleFigure'
import Sheet from './Sheet'

const TIERS: Tier[] = ['priority', 'standard', 'light']
const tierColors = (tiers: Record<Muscle, Tier>) =>
  Object.fromEntries(MUSCLES.filter((m) => tiers[m] !== 'light').map((m) => [m, tiers[m] === 'priority' ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.38)'])) as Partial<Record<Muscle, string>>

/** "What's your main goal?" Picking one fills in how many weekly sets each muscle gets (still editable per muscle). */
export default function GoalSheet({ onClose }: { onClose: () => void }) {
  const { goal } = useSettings()
  const [custom, setCustom] = useState(false)
  const [tiers, setTiers] = useState<Record<Muscle, Tier>>(goal?.tiers ?? GOALS[2].tiers)

  async function apply(id: GoalId, t: Record<Muscle, Tier>, label: string) {
    await setSetting('goal', { id, tiers: t })
    await setSetting('weeklyTargets', targetsFor(t))
    await setSetting('goalAsked', true)
    showToast(`Goal set: ${label}`, { sub: 'Your weekly set targets were updated.' })
    onClose()
  }
  const close = () => { void setSetting('goalAsked', true); onClose() }

  return (
    <Sheet title="What’s your main goal?" onClose={close}>
      <p className="mb-3 text-center text-sm text-mute">LiftLog is built around muscle growth. Pick what you want to build and it tunes your weekly sets, tips and suggestions to match.</p>
      {!custom ? (
        <div className="space-y-3">
          {GOALS.map((g, i) => (
            <button key={g.id} onClick={() => apply(g.id, g.tiers, g.label)} style={{ ['--i' as string]: i }}
              className={`rise press card flex w-full items-center gap-3 text-left !bg-card2 ${goal?.id === g.id ? 'ring-2 ring-accent' : ''}`}>
              <div className="flex shrink-0 gap-1">
                {(['front', 'back'] as const).map((v) => <MuscleFigure key={v} view={v} colors={tierColors(g.tiers)} className="h-24 w-12" />)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-extrabold leading-tight">{g.label}</div>
                <div className="mt-0.5 text-sm text-mute">{g.blurb}</div>
                {goal?.id === g.id && <div className="mt-1 text-xs font-bold text-accent">Current goal</div>}
              </div>
            </button>
          ))}
          <button className="btn w-full" onClick={() => setCustom(true)}>Customize muscle by muscle…</button>
          <p className="text-center text-xs text-mute">Bright = priority, dim = steady growth, grey = maintain. Not a fit? You can change any muscle later.</p>
        </div>
      ) : (
        <div>
          <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[11px] text-mute">{TIERS.map((t) => <div key={t}><b className="text-fg">{TIER_LABEL[t]}</b><br />{TIER_HINT[t]}</div>)}</div>
          <div className="space-y-1.5">
            {MUSCLES.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm font-medium">{MUSCLE_LABELS[m]}</span>
                <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-card2 p-1">
                  {TIERS.map((t) => <button key={t} onClick={() => setTiers((x) => ({ ...x, [m]: t }))} className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${tiers[m] === t ? 'bg-accent text-white' : 'text-mute'}`}>{TIER_LABEL[t]}</button>)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => setCustom(false)}>Back</button>
            <button className="btn btn-primary" onClick={() => apply('custom', tiers, 'Custom')}>Save goal</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
