import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { Title } from '../components/PageHeader'
import ExerciseThumb from '../components/ExerciseThumb'
import { describeTarget, nextTarget } from '../coaching/targets'
import { formatWeight } from '../units'
import { getPreviousSets } from '../workout/previous'
import { emptyDraft, startFromRoutine } from '../workout/draft'
import { startDraft, useDraft } from '../workout/store'
import ActiveWorkout from './ActiveWorkout'

export default function Workout() {
  const draft = useDraft()
  const nav = useNavigate()
  const { units, coachState } = useSettings()
  const [open, setOpen] = useState<number | null>(null)
  const data = useLiveQuery(async () => {
    const routines = await db.routines.orderBy('order').toArray()
    return {
      routines,
      ex: new Map((await db.exercises.toArray()).map((e) => [e.id!, e])),
      prev: await getPreviousSets(routines.flatMap((r) => r.items.map((i) => i.exerciseId))),
    }
  })

  if (draft) return <ActiveWorkout draft={draft} />
  if (!data) return <p className="text-mute">Loading…</p>

  return (
    <div className="space-y-5">
      <Title>Workout</Title>
      <button className="btn btn-primary w-full !min-h-[56px] text-lg" onClick={() => startDraft(emptyDraft(Date.now()))}>Start empty workout</button>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label">Routines</span>
          <span className="flex gap-4 text-sm">
            <Link to="/routine/new" className="text-accent">+ New</Link>
            <Link to="/routines" className="text-accent">Manage</Link>
          </span>
        </div>
        {data.routines.length === 0 && (
          <div className="card text-mute">No routines yet. Create one, or open a past workout in History and tap “Save as routine”.</div>
        )}
        {data.routines.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">{r.name}</div>
                <div className="truncate text-sm text-mute">{r.items.length} exercises · {r.items.reduce((n, i) => n + i.targetSets, 0)} sets</div>
              </div>
              <button
                className="btn btn-primary !min-h-[44px] px-5"
                onClick={() => { startDraft(startFromRoutine(r, data.ex, Date.now())); nav('/workout') }}
              >Start</button>
            </div>
            <div className="mt-3 flex -space-x-2 overflow-hidden">
              {r.items.slice(0, 8).map((i, k) => {
                const e = data.ex.get(i.exerciseId)
                return <div key={k} className="rounded-xl ring-2 ring-card"><ExerciseThumb name={e?.name ?? '?'} muscle={e?.primaryMuscles[0]} size={34} /></div>
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <button className="text-accent" onClick={() => setOpen(open === r.id ? null : r.id!)}>{open === r.id ? 'Hide targets' : '🎯 Next-session targets'}</button>
              <Link to={`/routine/${r.id}`} className="text-accent">Edit routine</Link>
            </div>
            {open === r.id && (
              <div className="mt-3 space-y-3 border-t border-line pt-3">
                {r.items.map((i, k) => {
                  const e = data.ex.get(i.exerciseId)
                  const t = e ? nextTarget(data.prev.get(i.exerciseId), {
                    repMin: i.repRangeMin, repMax: i.repRangeMax, incrementKg: e.weightIncrement,
                    fmt: (kg) => `${formatWeight(kg, units)} ${units}`, deload: i.exerciseId in coachState.deload,
                  }) : null
                  return (
                    <div key={k}>
                      <div className="text-[15px] font-semibold">{e?.name}</div>
                      {t ? (
                        <>
                          <div className="num text-sm font-bold text-accent">{describeTarget(t, (kg) => `${formatWeight(kg, units)} ${units}`)}</div>
                          <div className="text-xs text-mute">{t.reason}</div>
                        </>
                      ) : <div className="text-xs text-mute">No history yet. Log it once and a target appears.</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
