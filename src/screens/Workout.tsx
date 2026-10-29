import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCoaching } from '../coaching/useCoaching'
import SuggestionCard from '../components/coaching/SuggestionCard'
import { ExampleSheet, TemplateCard, TemplateSheet } from '../components/Templates'
import { Title } from '../components/PageHeader'
import { EXAMPLE_TEMPLATES, type ExampleTemplate } from '../data/templates'
import { db } from '../db/db'
import { useSettings, useSettingsReady } from '../db/settings'
import GoalSheet from '../components/GoalSheet'
import { nameKey } from '../db/exercises'
import { emptyDraft } from '../workout/draft'
import { getPreviousSets } from '../workout/previous'
import { startDraft, useDraft } from '../workout/store'
import type { Routine } from '../types'
import ActiveWorkout from './ActiveWorkout'

export default function Workout() {
  const draft = useDraft()
  const { units, coachState } = useSettings()
  const { h, c, settings } = useCoaching()
  const ready = useSettingsReady()
  const [goalOpen, setGoalOpen] = useState(false)
  // Ask about the goal once, after saved settings have loaded and there's some history to coach from.
  useEffect(() => { if (ready && !settings.goal && !settings.goalAsked && h && !draft) setGoalOpen(true) }, [ready, settings.goal, settings.goalAsked, h, draft])
  const [open, setOpen] = useState<Routine | null>(null)
  const [example, setExample] = useState<ExampleTemplate | null>(null)
  const prev = useLiveQuery(async () => {
    const routines = await db.routines.toArray()
    return getPreviousSets(routines.flatMap((r) => r.items.map((i) => i.exerciseId)))
  }, [h?.routines])

  if (draft) return <ActiveWorkout draft={draft} avgWeekly={c?.avgWeekly?.avg ?? null} />
  if (!h || !c || !prev) return <div className="space-y-3"><div className="skeleton h-12 w-52 rounded-xl" /><div className="skeleton h-14 rounded-2xl" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /></div></div>

  const have = new Set(h.routines.map((r) => nameKey(r.name)))
  const examples = EXAMPLE_TEMPLATES.filter((t) => !have.has(nameKey(t.name)))
  const names = (r: Routine) => r.items.map((i) => h.exercises.get(i.exerciseId)?.name ?? 'Exercise')

  return (
    <div className="space-y-5">
      <Title>Start Workout</Title>

      <section className="space-y-2">
        <div className="label">Quick start</div>
        <button className="btn btn-primary press w-full !min-h-[54px] text-[17px]" onClick={() => startDraft(emptyDraft(Date.now()))}>Start an Empty Workout</button>
      </section>

      {!settings.goal && ready && (
        <button onClick={() => setGoalOpen(true)} className="rise press card flex w-full items-center gap-3 text-left">
          <span className="text-3xl" aria-hidden>🎯</span>
          <span className="min-w-0 flex-1"><b className="block">What’s your main goal?</b><span className="text-sm text-mute">V-taper, glutes &amp; legs, or balanced. It tunes your weekly sets and tips.</span></span>
        </button>
      )}

      {c.suggestion && h.workouts.length > 0 && <SuggestionCard s={c.suggestion} h={h} counts={c.counts} settings={settings} />}
      {c.late && (
        <Link to="/profile" className="rise card block border border-warn/40" style={{ ['--i' as string]: 1 }}>
          <div className="text-sm font-bold text-warn">Heads up</div>
          <div className="text-sm">{c.late.text}</div>
        </Link>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="label">My templates</span>
          <span className="flex items-center gap-4 text-sm">
            <Link to="/routines" className="text-accent">Manage</Link>
            <Link to="/routine/new" aria-label="New template" className="press flex h-8 w-8 items-center justify-center rounded-full bg-accent text-lg font-bold leading-none text-white">+</Link>
          </span>
        </div>
        {h.routines.length === 0 ? (
          <div className="card text-sm text-mute">No templates yet. Tap <b className="text-fg">+</b>, add one of the examples below, or open a past workout in History and choose “Save as template”.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {h.routines.map((r, i) => <TemplateCard key={r.id} index={i} title={r.name} lines={names(r)} extra={`${r.items.length} exercises · ${r.items.reduce((n, x) => n + x.targetSets, 0)} sets`} onClick={() => setOpen(r)} />)}
          </div>
        )}
      </section>

      {examples.length > 0 && (
        <section className="space-y-2">
          <div className="label">Example templates</div>
          <div className="grid grid-cols-2 gap-3">
            {examples.map((t, i) => <TemplateCard key={t.id} index={i} dashed title={t.name} lines={t.items.map((x) => x.name)} extra={t.blurb} onClick={() => setExample(t)} />)}
          </div>
        </section>
      )}

      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
      {open && <TemplateSheet routine={open} exercises={h.exercises} prev={prev} units={units} deload={coachState.deload} onClose={() => setOpen(null)} />}
      {example && <ExampleSheet tpl={example} exercises={h.exercises} units={units} onClose={() => setExample(null)} />}
    </div>
  )
}
