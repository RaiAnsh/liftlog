import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { buildExercise, nameKey } from '../db/exercises'
import { useSettings } from '../db/settings'
import { imageUrl, instructionsFor, GYM_LIBRARY } from '../data/images'
import { BackBar } from '../components/PageHeader'
import PlateauCard from '../components/coaching/PlateauCard'
import { useCoaching } from '../coaching/useCoaching'
import ExerciseThumb from '../components/ExerciseThumb'
import MuscleFigure from '../components/MuscleFigure'
import { fmtSet } from '../components/WorkoutCard'
import { records, sessionPoints } from '../lib/exerciseStats'
import { formatVolume } from '../lib/stats'
import { formatEstimate, formatWeight } from '../units'
import { MUSCLE_LABELS } from '../types'

// Recharts is the biggest dependency; load it only when the Charts tab is opened (it's still precached for offline).
const ExerciseCharts = lazy(() => import('../components/ExerciseCharts'))

type Tab = 'about' | 'history' | 'charts' | 'records'
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function ExerciseDetail() {
  const key = decodeURIComponent(useParams().key ?? '')
  const { units } = useSettings()
  const [tab, setTab] = useState<Tab>('about')
  const [photos, setPhotos] = useState(false)
  const { h, c, settings } = useCoaching()
  const data = useLiveQuery(async () => {
    const ex = (await db.exercises.where('nameKey').equals(key).first()) ?? null
    const sets = ex ? await db.sets.where('exerciseId').equals(ex.id!).toArray() : []
    const wks = sets.length ? await db.workouts.where('id').anyOf([...new Set(sets.map((s) => s.workoutId))]).toArray() : []
    return { ex, points: sessionPoints(sets, wks) }
  }, [key])
  if (!data) return <p className="text-mute">Loading…</p>

  const libName = GYM_LIBRARY.find((n) => nameKey(n) === key)
  const name = data.ex?.name ?? libName ?? key
  const proto = data.ex ?? buildExercise(name, units)
  const imgs = [imageUrl(name, 0), imageUrl(name, 1)].filter(Boolean) as string[]
  const steps = instructionsFor(name)
  const rec = records(data.points)
  const hasHistory = data.points.length > 0
  const tabs: [Tab, string][] = [['about', 'About'], ['history', 'History'], ['charts', 'Charts'], ['records', 'Records']]
  const w = (kg: number) => `${formatWeight(kg, units)} ${units}`

  return (
    <div className="space-y-4">
      <BackBar />
      <div className="flex items-center gap-3">
        <ExerciseThumb name={name} muscles={proto.primaryMuscles} secondary={proto.secondaryMuscles} size={64} />
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{name}</h1>
          <div className="text-sm text-mute">{proto.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ') || 'No muscles tagged'} · <span className="capitalize">{proto.equipment}</span></div>
        </div>
      </div>

      {c && h && c.plateaus.filter((p) => p.exercise.nameKey === key).map((p) => <PlateauCard key={p.exercise.id} item={p} settings={settings} all={h.exercises} usage={c.usage} />)}

      {!data.ex && <button className="btn btn-primary w-full" onClick={() => db.exercises.add(buildExercise(name, units))}>Add to my exercises</button>}

      <div className="flex rounded-xl bg-card2 p-1">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === k ? 'bg-accent text-white' : 'text-mute'}`}>{l}</button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'back'] as const).map((v) => (
                <div key={v} className="text-center">
                  <MuscleFigure view={v} primary={proto.primaryMuscles} secondary={proto.secondaryMuscles} className="mx-auto h-60 w-full" title={`${name}, ${v} view`} />
                  <div className="label mt-1">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-center gap-5 text-xs text-mute">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />Primary</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-accent/45" />Secondary</span>
            </div>
          </div>
          {imgs.length > 0 && (
            <div>
              <button className="text-sm font-semibold text-accent" onClick={() => setPhotos((p) => !p)}>{photos ? 'Hide form photos' : 'Show form photos'}</button>
              {photos && (
                <div className="fade-in mt-2 grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
                  {imgs.map((u, i) => <img key={u} src={u} alt={`${name} step ${i + 1}`} className="aspect-square w-full bg-white object-cover" />)}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {proto.primaryMuscles.map((m) => <span key={m} className="chip chip-on flex items-center">{MUSCLE_LABELS[m]}</span>)}
            {proto.secondaryMuscles.map((m) => <span key={m} className="chip flex items-center">{MUSCLE_LABELS[m]}</span>)}
          </div>
          {steps.length > 0 && (
            <section>
              <div className="label mb-2">How to</div>
              <ol className="card list-decimal space-y-2 pl-9 text-[15px] leading-snug">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          )}
        </div>
      )}

      {tab !== 'about' && !hasHistory && <div className="card text-center text-mute">No sets logged for this exercise yet.</div>}

      {tab === 'history' && hasHistory && (
        <div className="space-y-2">
          <div className="text-sm text-mute">{data.points.length} sessions</div>
          {[...data.points].reverse().map((p) => (
            <Link key={p.workoutId} to={`/history/${p.workoutId}`} className="card row-press block py-3">
              <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{p.workoutName}</span><span className="text-mute">{fmtDate(p.date)}</span></div>
              <div className="num flex flex-wrap gap-x-4 gap-y-0.5">{p.sets.map((s) => <span key={s.id}>{fmtSet(s, units)}</span>)}</div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'charts' && hasHistory && (
        <Suspense fallback={<div className="card h-72 text-center text-mute">Loading chart…</div>}><ExerciseCharts points={data.points} units={units} /></Suspense>
      )}

      {tab === 'records' && hasHistory && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Heaviest weight', rec.heaviest && w(rec.heaviest.weightKg), rec.heaviest && `× ${rec.heaviest.reps} · ${fmtDate(rec.heaviest.date)}`],
              ['Best est. 1RM', rec.bestE1rm && `${formatEstimate(rec.bestE1rm.e1rmKg, units)} ${units}`, rec.bestE1rm && `${w(rec.bestE1rm.weightKg)} × ${rec.bestE1rm.reps} · ${fmtDate(rec.bestE1rm.date)}`],
              ['Best session volume', rec.bestVolume && `${formatVolume(Number(formatWeight(rec.bestVolume.volumeKg, units)))} ${units}`, rec.bestVolume && fmtDate(rec.bestVolume.date)],
              ['Sessions', String(data.points.length), `since ${fmtDate(data.points[0].date)}`],
            ].map(([l, v, sub]) => (
              <div key={String(l)} className="card">
                <div className="label">{l}</div>
                <div className="num mt-1 text-2xl font-bold">{v ?? '–'}</div>
                <div className="text-xs text-mute">{sub}</div>
              </div>
            ))}
          </div>
          <section>
            <div className="label mb-2">Best reps at each weight</div>
            <div className="overflow-hidden rounded-2xl bg-card">
              {rec.repsAtWeight.map((r, i) => (
                <div key={r.weightKg} className={`num flex items-center justify-between px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                  <span className="text-lg font-semibold">{w(r.weightKg)}</span>
                  <span><b>{r.reps}</b> reps <span className="ml-2 text-xs text-mute">{fmtDate(r.date)}</span></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
