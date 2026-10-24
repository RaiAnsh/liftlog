import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCoaching } from '../coaching/useCoaching'
import { addDays, daysIntoWeek, weekStartOf } from '../coaching/volume'
import { Title } from '../components/PageHeader'
import { ChevronRight } from '../components/Icons'
import WorkoutCard from '../components/WorkoutCard'
import Alerts from '../components/coaching/Alerts'
import PlateauCard from '../components/coaching/PlateauCard'
import SuggestionCard from '../components/coaching/SuggestionCard'
import WeeklySummaryCard from '../components/coaching/WeeklySummaryCard'
import { backupDue } from '../backup/backup'
import InstallHint from '../components/InstallHint'
import { volumeKg } from '../lib/stats'
import { formatWeight } from '../units'
import { useDraft } from '../workout/store'

export default function Home() {
  const { h, c, settings, now } = useCoaching()
  const draft = useDraft()
  const { units, weekStartDay } = settings

  const recent = useMemo(() => (h ? [...h.workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3) : []), [h])
  const week = useMemo(() => {
    if (!h || !c) return null
    const end = addDays(c.weekStart, 7)
    const ids = new Set(h.workouts.filter((w) => w.startedAt >= c.weekStart && w.startedAt < end).map((w) => w.id!))
    const sets = h.sets.filter((s) => ids.has(s.workoutId))
    return { workouts: ids.size, hard: sets.filter((s) => s.type !== 'warmup' && s.completed).length, vol: volumeKg(sets) }
  }, [h, c])

  if (!h || !c || !week) return <p className="text-mute">Loading…</p>
  const review = [...h.exercises.values()].filter((e) => e.needsReview).length
  const lastDay = daysIntoWeek(now, weekStartDay) === 6

  return (
    <div className="space-y-4">
      <Title sub={new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>Today</Title>

      {h.workouts.length === 0 ? (
        <div className="card space-y-3 text-center">
          <p className="text-lg font-semibold">Welcome to LiftLog</p>
          <p className="text-mute">Bring your history over from Strong to get started.</p>
          <Link to="/import" className="btn btn-primary flex items-center justify-center">Import Strong CSV</Link>
        </div>
      ) : draft ? (
        <Link to="/workout" className="btn btn-primary flex !min-h-[56px] items-center justify-center text-lg">Resume workout</Link>
      ) : c.suggestion ? (
        <>
          <SuggestionCard s={c.suggestion} h={h} counts={c.counts} settings={settings} />
          <Link to="/workout" className="btn flex items-center justify-center">Start something else</Link>
        </>
      ) : (
        <>
          <Link to="/workout" className="btn btn-primary flex !min-h-[56px] items-center justify-center text-lg">Start workout</Link>
          <Link to="/routine/new" className="card flex items-center justify-between"><span>Create a routine to get “up next” suggestions and targets</span><ChevronRight /></Link>
        </>
      )}

      {backupDue(settings.lastBackupAt, settings.installedAt, now, h.workouts.length > 0) && (
        <Link to="/settings" className="card flex items-center justify-between border border-accent/40">
          <span><b>Time for a backup.</b> <span className="text-mute">{settings.lastBackupAt ? 'It’s been over 2 weeks.' : 'You haven’t backed up yet.'} Your data only lives on this phone.</span></span>
          <ChevronRight />
        </Link>
      )}
      <InstallHint dismissible />
      <Alerts c={c} h={h} settings={settings} />
      {c.plateaus.slice(0, 2).map((p) => <PlateauCard key={p.exercise.id} item={p} settings={settings} all={h.exercises} usage={c.usage} />)}
      {c.plateaus.length > 2 && <Link to="/progress" className="block text-center text-sm text-accent">{c.plateaus.length - 2} more stalled lifts →</Link>}

      {lastDay && <WeeklySummaryCard h={h} settings={settings} weekStart={weekStartOf(now, weekStartDay)} now={now} title="This week in review" />}

      {h.workouts.length > 0 && (
        <>
          <div className="label -mb-2 px-1">This week</div>
          <div className="grid grid-cols-3 gap-3">
            {[['Workouts', String(week.workouts)], ['Hard sets', String(week.hard)], [`Volume (${units})`, week.vol ? Math.round(Number(formatWeight(week.vol, units))).toLocaleString() : '0']].map(([l, v]) => (
              <div key={l} className="card px-3 py-3"><div className="num text-[22px] font-bold leading-tight">{v}</div><div className="text-xs text-mute">{l}</div></div>
            ))}
          </div>
          <section>
            <div className="mb-2 flex items-center justify-between"><span className="label">Recent</span><Link to="/history" className="text-sm text-accent">See all</Link></div>
            <div className="space-y-3">
              {recent.map((w) => <WorkoutCard key={w.id} workout={w} sets={h.sets.filter((s) => s.workoutId === w.id)} exercises={h.exercises} units={units} />)}
            </div>
          </section>
        </>
      )}

      {review > 0 && (
        <Link to="/tags" className="card flex items-center justify-between border border-warn/40">
          <span>{review} exercise{review === 1 ? '' : 's'} need muscle tags. Coaching depends on them.</span><ChevronRight />
        </Link>
      )}
      <Link to="/exercises" className="card flex items-center justify-between"><span>Exercise library &amp; Planet Fitness machines</span><ChevronRight /></Link>
    </div>
  )
}
