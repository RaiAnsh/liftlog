import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCoaching } from '../coaching/useCoaching'
import SuggestionCard from '../components/coaching/SuggestionCard'
import { ExampleSheet, TemplateCard, TemplateSheet } from '../components/Templates'
import { Title } from '../components/PageHeader'
import { EXAMPLE_TEMPLATES, type ExampleTemplate } from '../data/templates'
import { db } from '../db/db'
import { useSettings, useSettingsReady } from '../db/settings'
import GoalSheet from '../components/GoalSheet'
import TemplateOfferSheet from '../components/TemplateOfferSheet'
import PlanSheet from '../components/PlanSheet'
import RecommendedSection from '../components/RecommendedSection'
import WeekStrip from '../components/WeekStrip'
import { DAY_SHORT, planToday, weekStrip } from '../coaching/plan'
import { weekStartOf } from '../coaching/volume'
import { startFromRoutine } from '../workout/draft'
import { inferTemplates, pendingOffers, type TemplateCandidate } from '../data/inferTemplates'
import { nameKey } from '../db/exercises'
import { emptyDraft } from '../workout/draft'
import { getPreviousSets } from '../workout/previous'
import { startDraft, useDraft } from '../workout/store'
import type { Routine } from '../types'
import ActiveWorkout from './ActiveWorkout'

export default function Workout() {
  const draft = useDraft()
  const { units, coachState } = useSettings()
  const { h, c, settings, now } = useCoaching()
  const [planOpen, setPlanOpen] = useState(false)
  const ready = useSettingsReady()
  const [goalOpen, setGoalOpen] = useState(false)
  const [offer, setOffer] = useState<TemplateCandidate[] | null>(null)
  const offered = useRef(false)
  // Ask about the goal once, after saved settings have loaded and there's some history to coach from.
  useEffect(() => { if (ready && !settings.goal && !settings.goalAsked && h && !draft) setGoalOpen(true) }, [ready, settings.goal, settings.goalAsked, h, draft])
  const [open, setOpen] = useState<Routine | null>(null)
  const [example, setExample] = useState<ExampleTemplate | null>(null)
  const prev = useLiveQuery(async () => {
    const routines = await db.routines.toArray()
    return getPreviousSets(routines.flatMap((r) => r.items.map((i) => i.exerciseId)))
  }, [h?.routines])

  // First time only: offer to turn the lifter's usual workouts (from their own history) into templates.
  // Waits for the goal question, asks at most once per launch, and any answer is remembered for good.
  const offers = useMemo(() => (h ? pendingOffers(inferTemplates(h, { now: Date.now(), repCeiling: settings.repCeiling }), h.routines, settings.templateChoices) : []), [h, settings.templateChoices, settings.repCeiling])
  useEffect(() => {
    if (ready && h && !draft && !goalOpen && (settings.goal || settings.goalAsked) && offers.length && !offer && !offered.current) {
      offered.current = true
      setOffer(offers)
    }
  }, [ready, h, draft, goalOpen, settings.goal, settings.goalAsked, offers, offer])

  if (draft) return <ActiveWorkout draft={draft} avgWeekly={c?.avgWeekly?.avg ?? null} />
  if (!h || !c || !prev) return <div className="space-y-3"><div className="skeleton h-12 w-52 rounded-xl" /><div className="skeleton h-14 rounded-2xl" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /></div></div>

  const have = new Set(h.routines.map((r) => nameKey(r.name)))
  const examples = EXAMPLE_TEMPLATES.filter((t) => !t.hidden && !have.has(nameKey(t.name)))
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

      {(() => {
        // With a weekly plan, "Up next" is what the plan says about today; otherwise it's the next template in your rotation.
        const ps = planToday(settings.plan, h.routines, h.workouts, settings.skipLog, now)
        if (ps?.state === 'planned') return <SuggestionCard s={{ routine: ps.routine, reason: `Planned for ${ps.label}`, alternative: null }} h={h} counts={c.counts} settings={settings} />
        if (ps) {
          const msg = ps.state === 'done' ? ['Done for today 🎉', 'Nice work. Recover well.'] : ps.state === 'skipped' ? ['Skipped today 😢', 'It happens. Back at it next time.'] : ['Rest day 😴', 'Recovery is when you actually grow.']
          return (
            <section className="rise card space-y-2">
              <div className="label">Today</div>
              <div className="text-2xl font-extrabold tracking-tight">{msg[0]}</div>
              <div className="text-sm text-mute">{msg[1]}{ps.next && <> Next: <b className="text-fg">{DAY_SHORT[ps.next.dayIndex]} · {ps.next.routine.name}</b>{ps.next.inDays === 1 ? ' (tomorrow)' : ''}.</>}</div>
              {c.suggestion && <button className="btn press w-full" onClick={() => { startDraft(startFromRoutine(c.suggestion!.routine, h.exercises, Date.now())) }}>Train anyway: {c.suggestion.routine.name}</button>}
            </section>
          )
        }
        return c.suggestion && h.workouts.length > 0 ? <SuggestionCard s={c.suggestion} h={h} counts={c.counts} settings={settings} /> : null
      })()}

      {settings.plan ? (
        <WeekStrip days={weekStrip(settings.plan, h.routines, h.workouts, settings.skipLog, weekStartOf(now, 1), now)} onEdit={() => setPlanOpen(true)} />
      ) : h.routines.length > 0 && (
        <button onClick={() => setPlanOpen(true)} className="rise press card flex w-full items-center gap-3 text-left">
          <span className="text-3xl" aria-hidden>🗓️</span>
          <span className="min-w-0 flex-1"><b className="block">Plan your week</b><span className="text-sm text-mute">Pick the days you’re free and I’ll suggest which workout goes on each.</span></span>
        </button>
      )}

      <RecommendedSection h={h} settings={settings} now={now} />
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
      {planOpen && <PlanSheet routines={h.routines} onClose={() => setPlanOpen(false)} />}
      {offer && h && <TemplateOfferSheet candidates={offer} exercises={h.exercises} onClose={() => setOffer(null)} />}
      {open && <TemplateSheet routine={open} exercises={h.exercises} prev={prev} units={units} deload={coachState.deload} hold={settings.phase === 'cut'} onClose={() => setOpen(null)} />}
      {example && <ExampleSheet tpl={example} exercises={h.exercises} units={units} onClose={() => setExample(null)} />}
    </div>
  )
}
