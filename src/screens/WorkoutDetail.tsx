import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { detectPRs } from '../lib/prs'
import { startFromWorkout } from '../workout/draft'
import { getDraft, startDraft } from '../workout/store'
import { BackBar } from '../components/PageHeader'
import ExerciseThumb from '../components/ExerciseThumb'
import { fmtCardio, formatDuration, formatVolume, groupByExercise, isHard, volumeKg } from '../lib/stats'
import { formatEstimate, formatWeight } from '../units'

const TAG: Record<string, { t: string; c: string }> = {
  warmup: { t: 'W', c: 'text-warn' }, drop: { t: 'D', c: 'text-accent' }, failure: { t: 'F', c: 'text-red-500' },
}

export default function WorkoutDetail() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const { units, defaultRestSeconds } = useSettings()
  const justDone = useSearchParams()[0].get('done') === '1'
  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(id)
    const priorStart = new Map((await db.workouts.toArray()).map((x) => [x.id!, x.startedAt]))
    const sets = await db.sets.where('workoutId').equals(id).sortBy('order')
    const ex = new Map((await db.exercises.toArray()).map((e) => [e.id!, e]))
    // Everything logged before this workout, for PR detection on the finish summary.
    const ids = [...new Set(sets.map((s) => s.exerciseId))]
    const prior = workout && ids.length
      ? (await db.sets.where('exerciseId').anyOf(ids).toArray()).filter((s) => s.workoutId !== id && (priorStart.get(s.workoutId) ?? 0) < workout.startedAt)
      : []
    return { workout, sets, ex, prior }
  }, [id])
  if (!data) return <p className="text-mute">Loading…</p>
  const w = data.workout
  if (!w) return <><BackBar /><p>Workout not found.</p></>

  async function remove() {
    if (!confirm('Delete this workout and all its sets?')) return
    await db.transaction('rw', db.workouts, db.sets, async () => {
      await db.sets.where('workoutId').equals(id).delete()
      await db.workouts.delete(id)
    })
    nav('/history', { replace: true })
  }

  function again() {
    if (getDraft() && !confirm('Replace the workout in progress?')) return
    startDraft(startFromWorkout(w!, data!.sets, data!.ex, defaultRestSeconds, Date.now()))
    nav('/workout')
  }

  async function saveAsRoutine() {
    const last = await db.routines.orderBy('order').last()
    const seen = groupByExercise(data!.sets)
    const rid = await db.routines.add({
      name: w!.name, order: (last?.order ?? -1) + 1,
      items: seen.map((g) => {
        const e = data!.ex.get(g.exerciseId)
        return { exerciseId: g.exerciseId, targetSets: Math.max(1, g.sets.filter((s) => s.type !== 'warmup').length), repRangeMin: e?.repRangeMin ?? 8, repRangeMax: e?.repRangeMax ?? 12, restSeconds: defaultRestSeconds, notes: '' }
      }),
    })
    nav(`/routine/${rid}`)
  }

  const prs = justDone ? detectPRs(data.sets, data.prior) : []
  const dur = formatDuration(w.startedAt, w.endedAt)
  const vol = volumeKg(data.sets)
  return (
    <div className="space-y-3">
      <BackBar />
      {justDone && (
        <div className="card border border-good/40 bg-good/10">
          <div className="text-lg font-bold">Workout saved 💪</div>
          {prs.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-sm">
              {prs.map((p) => (
                <li key={p.exerciseId}>
                  🏆 <b>{data.ex.get(p.exerciseId)?.name}</b>
                  {p.weightKg !== undefined && ` · heaviest ${formatWeight(p.weightKg, units)} ${units}`}
                  {p.e1rmKg !== undefined && ` · est. 1RM ${formatEstimate(p.e1rmKg, units)} ${units}`}
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-mute">No new records this time. Consistency counts.</div>}
        </div>
      )}
      <div>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{w.name}</h1>
        <div className="text-mute">{new Date(w.startedAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[['Duration', dur ?? '–'], ['Volume', vol ? `${formatVolume(Number(formatWeight(vol, units)))} ${units}` : '–'], ['Sets', String(data.sets.filter(isHard).length)]].map(([l, v]) => (
          <div key={l} className="card px-3 py-3 text-center">
            <div className="num whitespace-nowrap text-lg font-bold">{v}</div>
            <div className="text-xs text-mute">{l}</div>
          </div>
        ))}
      </div>
      {w.notes && <div className="card text-sm">{w.notes}</div>}

      {groupByExercise(data.sets).map((g) => {
        const ex = data.ex.get(g.exerciseId)
        let n = 0
        return (
          <div key={g.exerciseId} className="card">
            <Link to={`/exercise/${encodeURIComponent(ex?.nameKey ?? '')}`} className="mb-3 flex items-center gap-3">
              <ExerciseThumb name={ex?.name ?? '?'} muscles={ex?.primaryMuscles} secondary={ex?.secondaryMuscles} size={44} />
              <span className="flex-1 font-semibold text-accent">{ex?.name}</span>
            </Link>
            <div className="label mb-1 grid grid-cols-[36px_1fr_auto] px-1"><span>Set</span><span>Weight × reps</span><span>RPE</span></div>
            {g.sets.map((s) => {
              const tag = TAG[s.type]
              if (!tag) n++
              return (
                <div key={s.id} className="num grid grid-cols-[36px_1fr_auto] rounded-lg px-1 py-1.5 odd:bg-card2/60">
                  <span className={`font-semibold ${tag?.c ?? 'text-mute'}`}>{tag?.t ?? n}</span>
                  <span>{s.weightKg > 0 ? `${formatWeight(s.weightKg, units)} ${units} × ${s.reps}` : s.reps > 0 ? `${s.reps} reps` : fmtCardio(s.seconds, s.distance, units)}</span>
                  <span className="text-mute">{s.rpe ?? ''}</span>
                </div>
              )
            })}
          </div>
        )
      })}
      <div className="grid grid-cols-2 gap-3">
        <button className="btn btn-primary" onClick={again}>Start again</button>
        <button className="btn" onClick={saveAsRoutine}>Save as template</button>
      </div>
      <button className="btn btn-danger w-full" onClick={remove}>Delete workout</button>
    </div>
  )
}
