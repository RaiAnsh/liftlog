import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { Title } from '../components/PageHeader'
import { SearchIcon } from '../components/Icons'
import WorkoutCard from '../components/WorkoutCard'

const PAGE = 30

export default function History() {
  const { units } = useSettings()
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

  if (!data) return <p className="text-mute">Loading…</p>
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
      <div className="text-sm text-mute">{rows.length} workouts</div>
      {rows.slice(0, limit).map((w) => (
        <WorkoutCard key={w.id} workout={w} sets={data.per.get(w.id!) ?? []} exercises={data.exMap} units={units} />
      ))}
      {rows.length > limit && <button className="btn w-full" onClick={() => setLimit(limit + PAGE)}>Show more</button>}
    </div>
  )
}
