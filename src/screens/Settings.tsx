import { Link } from 'react-router-dom'
import { setSetting, useSettings } from '../db/settings'
import { BackBar, Title } from '../components/PageHeader'
import { ChevronRight } from '../components/Icons'
import BackupSection from '../components/BackupSection'
import InstallHint from '../components/InstallHint'
import GoalSheet from '../components/GoalSheet'
import { goalLabel } from '../coaching/goals'
import { useState } from 'react'

const PLATE_OPTIONS = { lb: [100, 55, 45, 35, 25, 15, 10, 5, 2.5, 1.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] }

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-card2 p-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`flex-1 rounded-lg py-2 font-semibold capitalize ${value === o ? 'bg-accent text-white' : 'text-mute'}`}>{o}</button>
      ))}
    </div>
  )
}

const LinkRow = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="row-press flex items-center justify-between border-t border-line px-4 py-3.5 first:border-t-0">
    <span>{children}</span><span className="text-mute"><ChevronRight /></span>
  </Link>
)

export default function Settings() {
  const s = useSettings()
  const [goalOpen, setGoalOpen] = useState(false)
  return (
    <div className="space-y-5">
      <BackBar />
      <Title>Settings</Title>
      <InstallHint />
      <section className="space-y-2">
        <div className="label px-1">Training</div>
        <div className="overflow-hidden rounded-2xl bg-card">
          <button onClick={() => setGoalOpen(true)} className="row-press flex w-full items-center justify-between px-4 py-3.5 text-left"><span>Training goal <span className="text-mute">· {goalLabel(s.goal) ?? 'not set'}</span></span><span className="text-mute"><ChevronRight /></span></button>
          <LinkRow to="/science">The science behind LiftLog</LinkRow>
        </div>
      </section>
      <BackupSection />
      <section className="space-y-2">
        <div className="label px-1">Units</div>
        <Seg value={s.units} options={['lb', 'kg']} onChange={(v) => setSetting('units', v)} />
      </section>
      <section className="space-y-2">
        <div className="label px-1">Week starts on</div>
        <Seg value={s.weekStartDay === 1 ? 'monday' : 'sunday'} options={['monday', 'sunday']} onChange={(v) => setSetting('weekStartDay', v === 'monday' ? 1 : 0)} />
      </section>
      <section className="space-y-2">
        <div className="label px-1">Barbell &amp; plates ({s.units})</div>
        <div className="card space-y-3">
          <label className="flex items-center justify-between">
            <span>Empty bar weight</span>
            <input inputMode="decimal" value={s.barWeight[s.units]} onFocus={(e) => e.target.select()}
              onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')); setSetting('barWeight', { ...s.barWeight, [s.units]: Number.isFinite(v) ? v : 0 }) }}
              className="num h-11 w-24 rounded-lg bg-card2 text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-accent" />
          </label>
          <div>
            <div className="mb-2 text-sm text-mute">Plates available (tap to toggle)</div>
            <div className="flex flex-wrap gap-2">
              {PLATE_OPTIONS[s.units].map((p) => {
                const on = s.plates[s.units].includes(p)
                return (
                  <button key={p} className={`chip num flex items-center ${on ? 'chip-on' : ''}`}
                    onClick={() => setSetting('plates', { ...s.plates, [s.units]: on ? s.plates[s.units].filter((x) => x !== p) : [...s.plates[s.units], p] })}>{p}</button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-2">
        <div className="label px-1">Appearance</div>
        <Seg value={s.theme} options={['dark', 'light']} onChange={(v) => setSetting('theme', v)} />
      </section>
      <section className="space-y-2">
        <div className="label px-1">Data</div>
        <div className="overflow-hidden rounded-2xl bg-card">
          <LinkRow to="/import">Import from Strong</LinkRow>
          <LinkRow to="/tags">Review muscle tags</LinkRow>
          <LinkRow to="/routines">Templates &amp; rotation</LinkRow>
          <LinkRow to="/exercises">Exercise library</LinkRow>
          <LinkRow to="/plates">Plate calculator</LinkRow>
        </div>
      </section>
      <p className="px-1 text-xs text-mute">Exercise images and instructions: free-exercise-db (public domain).</p>
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
    </div>
  )
}
