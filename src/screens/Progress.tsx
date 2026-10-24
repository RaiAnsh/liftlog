import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useCoaching } from '../coaching/useCoaching'
import { addDays } from '../coaching/volume'
import PlateauCard from '../components/coaching/PlateauCard'
import VolumeDashboard from '../components/coaching/VolumeDashboard'
import WeeklySummaryCard from '../components/coaching/WeeklySummaryCard'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { Title } from '../components/PageHeader'
import { ChevronRight } from '../components/Icons'
import ExerciseThumb from '../components/ExerciseThumb'
import { prTimeline } from '../lib/prs'
import { e1rm, isHard } from '../lib/stats'
import { formatEstimate, formatWeight } from '../units'

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function Progress() {
  const { units } = useSettings()
  const { h, c, settings, now } = useCoaching()
  const [wk, setWk] = useState<'this' | 'last'>('this')
  const data = useLiveQuery(async () => {
    const [sets, workouts, exercises] = await Promise.all([db.sets.toArray(), db.workouts.toArray(), db.exercises.toArray()])
    const ex = new Map(exercises.map((e) => [e.id!, e]))
    const starts = new Map(workouts.map((w) => [w.id!, w.startedAt]))
    const prs = prTimeline(sets, starts).sort((a, b) => b.date - a.date).slice(0, 8)
    const agg = new Map<number, { sets: number; best: number; sessions: Set<number> }>()
    for (const s of sets) {
      const a = agg.get(s.exerciseId) ?? agg.set(s.exerciseId, { sets: 0, best: 0, sessions: new Set() }).get(s.exerciseId)!
      a.sets++
      if (isHard(s)) { a.best = Math.max(a.best, e1rm(s.weightKg, s.reps)); a.sessions.add(s.workoutId) }
    }
    const top = [...agg.entries()].filter(([, a]) => a.best > 0).sort((a, b) => b[1].sets - a[1].sets).slice(0, 12)
      .map(([id, a]) => ({ ex: ex.get(id)!, ...a, sessions: a.sessions.size }))
    return { prs, top, ex }
  })
  if (!data || !h || !c) return <p className="text-mute">Loading…</p>
  const w = (kg: number) => `${formatWeight(kg, units)} ${units}`

  return (
    <div className="space-y-5">
      <Title>Progress</Title>

      <VolumeDashboard counts={c.counts} breakdown={c.breakdown} settings={settings} />

      <section className="space-y-2">
        <div className="flex rounded-xl bg-card2 p-1">
          {(['this', 'last'] as const).map((k) => (
            <button key={k} onClick={() => setWk(k)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${wk === k ? 'bg-accent text-white' : 'text-mute'}`}>{k === 'this' ? 'This week' : 'Last week'}</button>
          ))}
        </div>
        <WeeklySummaryCard h={h} settings={settings} now={now} weekStart={wk === 'this' ? c.weekStart : addDays(c.weekStart, -7)} title={wk === 'this' ? 'Weekly summary' : 'Last week'} />
      </section>

      {c.plateaus.length > 0 && (
        <section className="space-y-2">
          <div className="label">Stalled lifts</div>
          {c.plateaus.map((p) => <PlateauCard key={p.exercise.id} item={p} settings={settings} all={h.exercises} usage={c.usage} />)}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/plates" className="card row-press"><div className="text-2xl">🏋️</div><div className="mt-1 font-semibold">Plate calculator</div><div className="text-xs text-mute">What to load per side</div></Link>
        <Link to="/exercises" className="card row-press"><div className="text-2xl">📚</div><div className="mt-1 font-semibold">Exercise library</div><div className="text-xs text-mute">Photos &amp; Planet Fitness machines</div></Link>
      </div>

      <section>
        <div className="label mb-2">Recent records</div>
        {data.prs.length === 0 ? <div className="card text-mute">Records show up here once you beat a previous best.</div> : (
          <div className="overflow-hidden rounded-2xl bg-card">
            {data.prs.map((p, i) => {
              const e = data.ex.get(p.exerciseId)
              return (
                <Link key={`${p.workoutId}-${p.exerciseId}`} to={`/exercise/${encodeURIComponent(e?.nameKey ?? '')}`} className={`row-press flex items-center gap-3 px-3 py-2.5 ${i ? 'border-t border-line' : ''}`}>
                  <ExerciseThumb name={e?.name ?? '?'} muscle={e?.primaryMuscles[0]} size={44} />
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

      <section>
        <div className="mb-2 flex items-center justify-between"><span className="label">Your lifts</span><Link to="/exercises" className="text-sm text-accent">All exercises</Link></div>
        <div className="overflow-hidden rounded-2xl bg-card">
          {data.top.map((t, i) => (
            <Link key={t.ex.id} to={`/exercise/${encodeURIComponent(t.ex.nameKey)}`} className={`row-press flex items-center gap-3 px-3 py-2.5 ${i ? 'border-t border-line' : ''}`}>
              <ExerciseThumb name={t.ex.name} muscle={t.ex.primaryMuscles[0]} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.ex.name}</div>
                <div className="text-sm text-mute">{t.sessions} sessions · est. 1RM <span className="num">{formatEstimate(t.best, units)} {units}</span></div>
              </div>
              <span className="text-mute"><ChevronRight /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
