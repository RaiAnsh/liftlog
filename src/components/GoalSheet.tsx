import { useState } from 'react'
import { GOALS, STYLE_HINT, STYLE_LABEL, STYLE_RANGE, suggestStyle, TIER_HINT, TIER_LABEL, targetsFor } from '../coaching/goals'
import { useHistory } from '../coaching/useCoaching'
import { setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'
import { MUSCLES, MUSCLE_LABELS, type GoalId, type Muscle, type Phase, type Tier, type VolumeStyle } from '../types'
import MuscleFigure from './MuscleFigure'
import Sheet from './Sheet'

const TIERS: Tier[] = ['priority', 'standard', 'light']
const PHASES: { id: Phase; label: string; hint: string }[] = [
  { id: 'build', label: 'Building', hint: 'Eating at or above maintenance. Progress is the goal: add weight or reps when you can.' },
  { id: 'maintain', label: 'Maintaining', hint: 'Holding body weight steady while you keep training.' },
  { id: 'cut', label: 'Cutting', hint: 'In a calorie deficit. Matching your last session keeps your muscle, so the coach stops pushing for more.' },
]
const STYLES: VolumeStyle[] = ['efficient', 'standard', 'high']
const tierColors = (tiers: Record<Muscle, Tier>) =>
  Object.fromEntries(MUSCLES.filter((m) => tiers[m] !== 'light').map((m) => [m, tiers[m] === 'priority' ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.38)'])) as Partial<Record<Muscle, string>>

/** "What's your main goal?" Picking one fills in how many weekly sets each muscle gets (still editable per muscle). */
export default function GoalSheet({ onClose }: { onClose: () => void }) {
  const { goal, phase, volumeStyle } = useSettings()
  const h = useHistory()
  const suggested = h ? suggestStyle(h.workouts, h.sets) : null
  const [custom, setCustom] = useState(false)
  const [tiers, setTiers] = useState<Record<Muscle, Tier>>(goal?.tiers ?? GOALS[2].tiers)

  async function apply(id: GoalId, t: Record<Muscle, Tier>, label: string) {
    await setSetting('goal', { id, tiers: t })
    await setSetting('weeklyTargets', targetsFor(t, volumeStyle))
    await setSetting('goalAsked', true)
    showToast(`Goal set: ${label}`, { sub: 'Your weekly set targets were updated.' })
    onClose()
  }
  async function pickPhase(p: Phase) {
    await setSetting('phase', p)
    if (p === 'cut') showToast('Cutting mode on', { sub: 'Targets now aim to match last time instead of pushing for more.' })
  }
  async function pickStyle(v: VolumeStyle) {
    await setSetting('volumeStyle', v)
    if (goal) await setSetting('weeklyTargets', targetsFor(goal.tiers, v)) // re-tune the weekly ranges to the new style
    showToast(`${STYLE_LABEL[v]} volume`, { sub: goal ? 'Your weekly set targets were updated.' : 'It will apply when you pick a goal.' })
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

          <div className="space-y-2 pt-2">
            <div className="label">Where are you right now?</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-card2 p-1">
              {PHASES.map((p) => <button key={p.id} onClick={() => pickPhase(p.id)} className={`rounded-lg py-2 text-sm font-bold transition-colors ${phase === p.id ? 'bg-accent text-white' : 'text-mute'}`}>{p.label}</button>)}
            </div>
            <p className="text-xs text-mute">{PHASES.find((p) => p.id === phase)!.hint}</p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="label">How much do you train each muscle?</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-card2 p-1">
              {STYLES.map((v) => (
                <button key={v} onClick={() => pickStyle(v)} className={`rounded-lg py-2 text-sm font-bold transition-colors ${volumeStyle === v ? 'bg-accent text-white' : 'text-mute'}`}>
                  {STYLE_LABEL[v]}{suggested === v && <span className="ml-1 text-[10px] opacity-80">★</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-mute">
              {STYLE_HINT[volumeStyle]} Priority muscles aim for {STYLE_RANGE[volumeStyle].priority.min}–{STYLE_RANGE[volumeStyle].priority.max} hard sets a week.
              {suggested && <> <b className="text-fg">★ {STYLE_LABEL[suggested]}</b> matches how you usually train{suggested === 'efficient' ? ' (about 2 sets per exercise)' : ''}.</>}
            </p>
          </div>
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
