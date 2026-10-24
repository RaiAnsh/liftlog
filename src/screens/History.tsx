import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { db } from '../db/db'
import { setSetting, useSettings } from '../db/settings'
import { removeSkip } from '../coaching/skips'
import { Title } from '../components/PageHeader'
import { SearchIcon } from '../components/Icons'
import WorkoutCard from '../components/WorkoutCard'

const PAGE = 30

export default function History() {
  const { units, skipLog } = useSettings()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const dq = useDeferredValue(q)

  const data = useLiveQuery(async () => {
    const [workouts, sets, exercises] = await Promise.all([
      db.workouts.orderBy('startedAt').reverse().toArray(), db.sets.toArray(), db.exercises.toArray(),
    ])
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    const per = new Map<number, typeof sets>()
    for (const s of sets) (per.get(s.workoutId) ?? per.set(s.workoutId, []).get(s.workoutId)!).push(s)
    return { workouts, per, exMap }
  })

  const rows = useMemo(() => {
    if (!data) return []
    const t = dq.trim().toLowerCase()
    if (!t) return data.workouts
    return data.workouts.filter(
      (w) => w.name.toLowerCase().includes(t) ||
        (data.per.get(w.id!) ?? []).some((s) => data.exMap.get(s.exerciseId)?.name.toLowerCase().includes(t)),
    )
  }, [data, dq])

  const skips = useMemo(() => {
    const t = dq.trim().toLowerCase()
    return [...skipLog].filter((x) => !t || x.name.toLowerCase().includes(t) || 'skipped'.includes(t)).sort((a, b) => b.at - a.at)
  }, [skipLog, dq])
  const timeline = useMemo(() => [
    ...rows.map((w) => ({ kind: 'w' as const, at: w.startedAt, w })),
    ...skips.map((x) => ({ kind: 's' as const, at: x.at, x })),
  ].sort((a, b) => b.at - a.at), [rows, skips])

  if (!data) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
  return (
    <div className="space-y-3">
      <Title>History</Title>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><SearchIcon /></span>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} placeholder="Search workouts or exercises"
          className="w-full rounded-2xl bg-card py-3 pl-10 pr-4 outline-none placeholder:text-mute focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="text-sm text-mute">{rows.length} workouts{skips.length > 0 && <> · {skips.length} skipped 😢</>}</div>
      {timeline.slice(0, limit).map((e, i) => e.kind === 'w' ? (
        <div key={`w${e.w.id}`} className="rise" style={{ ['--i' as string]: Math.min(i, 6) }}>
          <WorkoutCard workout={e.w} sets={data.per.get(e.w.id!) ?? []} exercises={data.exMap} units={units} />
        </div>
      ) : (
        <div key={`s${e.x.id}`} className="rise card flex items-center gap-3 !bg-card/60" style={{ ['--i' as string]: Math.min(i, 6) }}>
          <span className="text-3xl" aria-hidden>😢</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Skipped {e.x.name}</div>
            <div className="text-sm text-mute">{new Date(e.x.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{e.x.reason ? ` · ${e.x.reason}` : ''}</div>
          </div>
          <button className="press rounded-lg px-3 py-2 text-sm font-semibold text-accent" onClick={() => setSetting('skipLog', removeSkip(skipLog, e.x.id))}>Undo</button>
        </div>
      ))}
      {timeline.length > limit && <button className="btn w-full" onClick={() => setLimit(limit + PAGE)}>Show more</button>}
      {timeline.length === 0 && <div className="card text-center text-mute">Nothing here yet.</div>}
    </div>
  )
}
