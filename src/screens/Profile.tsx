import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { backupDue } from '../backup/backup'
import { useCoaching } from '../coaching/useCoaching'
import { addDays } from '../coaching/volume'
import Alerts from '../components/coaching/Alerts'
import CoachSection from '../components/coaching/CoachSection'
import PlateauCard from '../components/coaching/PlateauCard'
import VolumeDashboard from '../components/coaching/VolumeDashboard'
import WeeklySummaryCard from '../components/coaching/WeeklySummaryCard'
import ExerciseThumb from '../components/ExerciseThumb'
import { ChevronRight, GearIcon } from '../components/Icons'
import InstallHint from '../components/InstallHint'
import MuscleFigure, { viewFor } from '../components/MuscleFigure'
import { Title } from '../components/PageHeader'
import { db } from '../db/db'
import { prTimeline } from '../lib/prs'
import { MUSCLE_LABELS } from '../types'
import { formatEstimate, formatWeight } from '../units'

const WeeklyChart = lazy(() => import('../components/coaching/WeeklyChart'))
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function Insight({ i, emoji, label, title, detail, to, figure }: { i: number; emoji: string; label: string; title: string; detail: string; to?: string; figure?: React.ReactNode }) {
  const body = (
    <div className="rise press card flex items-center gap-3" style={{ ['--i' as string]: i }}>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-card2">{figure}</div>
      <div className="min-w-0 flex-1">
        <div className="label">{emoji} {label}</div>
        <div className="line-clamp-2 text-[17px] font-bold leading-tight first-letter:uppercase">{title}</div>
        <div className="text-sm text-mute">{detail}</div>
      </div>
      {to && <span className="text-mute"><ChevronRight /></span>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Profile() {
  const { h, c, settings, now } = useCoaching()
  const [wk, setWk] = useState<'this' | 'last'>('this')
  const prs = useLiveQuery(async () => {
    const [sets, workouts] = await Promise.all([db.sets.toArray(), db.workouts.toArray()])
    return prTimeline(sets, new Map(workouts.map((w) => [w.id!, w.startedAt]))).sort((a, b) => b.date - a.date).slice(0, 6)
  })
  if (!h || !c) return <div className="space-y-3"><div className="skeleton h-12 w-40 rounded-xl" /><div className="skeleton h-52 rounded-2xl" /><div className="skeleton h-24 rounded-2xl" /></div>

  const { units } = settings
  const first = h.workouts.length ? Math.min(...h.workouts.map((w) => w.startedAt)) : null
  const hl = c.highlights
  const w = (kg: number) => `${formatWeight(kg, units)} ${units}`
  const liftEx = hl.lift ? h.exercises.get(hl.lift.exerciseId) : null
  const fig = (m: keyof typeof MUSCLE_LABELS | undefined, hue: 'accent' | 'warn' | 'good') =>
    m ? <MuscleFigure view={viewFor([m])} crop colors={{ [m]: `rgb(var(--${hue}))` }} primary={[m]} className="h-full w-full" /> : null

  return (
    <div className="space-y-4">
      <Title
        sub={first ? `${h.workouts.length} workouts since ${new Date(first).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : 'Your training at a glance'}
        right={<Link to="/settings" aria-label="Settings" className="press flex h-11 w-11 items-center justify-center rounded-full bg-card text-mute"><GearIcon /></Link>}
      >Profile</Title>

      {h.workouts.length === 0 && (
        <div className="card space-y-3 text-center">
          <p className="text-lg font-semibold">Welcome to ARLog</p>
          <p className="text-mute">Bring your history over from Strong to see your stats here.</p>
          <Link to="/import" className="btn btn-primary flex items-center justify-center">Import Strong CSV</Link>
        </div>
      )}

      {backupDue(settings.lastBackupAt, settings.installedAt, now, h.workouts.length > 0) && (
        <Link to="/settings" className="rise card flex items-center justify-between border border-accent/40">
          <span><b>Time for a backup.</b> <span className="text-mute">{settings.lastBackupAt ? 'It’s been over 2 weeks.' : 'You haven’t backed up yet.'} Your data only lives on this phone.</span></span>
          <ChevronRight />
        </Link>
      )}
      <InstallHint dismissible />

      {h.workouts.length > 0 && (
        <>
          <Suspense fallback={<div className="skeleton h-52 rounded-2xl" />}><WeeklyChart totals={c.totals} units={units} /></Suspense>

          <section className="space-y-3">
            <div className="label">Right now</div>
            {hl.best && <Insight i={0} emoji="💪" label="Best right now" title={hl.best.title} detail={hl.best.detail} figure={fig(hl.best.muscle, 'good')} />}
            {hl.improve && <Insight i={1} emoji="🎯" label="Work on this" title={hl.improve.title} detail={hl.improve.detail} figure={fig(hl.improve.muscle, 'warn')} />}
            {hl.lift && liftEx && (
              <Insight i={2} emoji="🔥" label="Best lift" to={`/exercise/${encodeURIComponent(liftEx.nameKey)}`}
                title={`${liftEx.name} is up ${Math.round(hl.lift.pct * 100)}%`}
                detail={`Est. 1RM ${formatEstimate(hl.lift.fromKg, units)} → ${formatEstimate(hl.lift.toKg, units)} ${units} in ${hl.lift.weeks} week${hl.lift.weeks === 1 ? '' : 's'}`}
                figure={<ExerciseThumb name={liftEx.name} muscles={liftEx.primaryMuscles} secondary={liftEx.secondaryMuscles} size={64} />} />
            )}
            {!hl.best && !hl.improve && !hl.lift && <div className="card text-mute">Log a few workouts and your best areas and next focus show up here.</div>}
          </section>

          <CoachSection h={h} settings={settings} now={now} />

          <Alerts c={c} h={h} settings={settings} />

          <VolumeDashboard counts={c.counts} breakdown={c.breakdown} last={c.last} now={now} settings={settings} />

          {c.plateaus.length > 0 && (
            <section className="space-y-2">
              <div className="label">Stalled lifts</div>
              {c.plateaus.map((p) => <PlateauCard key={p.exercise.id} item={p} settings={settings} all={h.exercises} usage={c.usage} />)}
            </section>
          )}

          <section>
            <div className="label mb-2">Recent records</div>
            {!prs || prs.length === 0 ? <div className="card text-mute">Records show up here once you beat a previous best.</div> : (
              <div className="overflow-hidden rounded-2xl bg-card">
                {prs.map((p, i) => {
                  const e = h.exercises.get(p.exerciseId)
                  return (
                    <Link key={`${p.workoutId}-${p.exerciseId}`} to={`/exercise/${encodeURIComponent(e?.nameKey ?? '')}`} className={`row-press rise flex items-center gap-3 px-3 py-2.5 ${i ? 'border-t border-line' : ''}`} style={{ ['--i' as string]: i }}>
                      <ExerciseThumb name={e?.name ?? '?'} muscles={e?.primaryMuscles} secondary={e?.secondaryMuscles} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">🏆 {e?.name}</div>
                        <div className="num text-sm text-mute">{w(p.weightKg)} × {p.reps} · est. 1RM {formatEstimate(p.e1rmKg, units)} {units}</div>
                      </div>
                      <div className="text-xs text-mute">{fmtDate(p.date)}</div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex rounded-xl bg-card2 p-1">
              {(['this', 'last'] as const).map((k) => (
                <button key={k} onClick={() => setWk(k)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${wk === k ? 'bg-accent text-white' : 'text-mute'}`}>{k === 'this' ? 'This week' : 'Last week'}</button>
              ))}
            </div>
            <WeeklySummaryCard h={h} settings={settings} now={now} weekStart={wk === 'this' ? c.weekStart : addDays(c.weekStart, -7)} title={wk === 'this' ? 'Weekly summary' : 'Last week'} />
          </section>
        </>
      )}

      <section className="space-y-2">
        <div className="label">Tools</div>
        <div className="overflow-hidden rounded-2xl bg-card">
          {[['/science', 'The science behind ARLog'], ['/plates', 'Plate calculator'], ['/routines', 'Manage templates & rotation'], ['/tags', 'Review muscle tags'], ['/settings', 'Settings, backup & import']].map(([to, label], i) => (
            <Link key={to} to={to} className={`row-press flex items-center justify-between px-4 py-3.5 ${i ? 'border-t border-line' : ''}`}><span>{label}</span><span className="text-mute"><ChevronRight /></span></Link>
          ))}
        </div>
      </section>
    </div>
  )
}
