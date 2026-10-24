import { Link } from 'react-router-dom'
import ExerciseThumb from './ExerciseThumb'
import { bestSet, formatDuration, formatVolume, groupByExercise, isHard, volumeKg } from '../lib/stats'
import { formatWeight } from '../units'
import type { Exercise, Unit, Workout, WorkoutSet } from '../types'

export const fmtSet = (s: WorkoutSet, units: Unit) =>
  s.weightKg > 0 ? `${formatWeight(s.weightKg, units)} ${units} × ${s.reps}` : s.reps > 0 ? `${s.reps} reps` : `${Math.round(s.seconds / 60)} min`

/** Strong-style history card: title, date, stats, then the exercises with their best set. */
export default function WorkoutCard({
  workout: w, sets, exercises, units,
}: { workout: Workout; sets: WorkoutSet[]; exercises: Map<number, Exercise>; units: Unit }) {
  const groups = groupByExercise([...sets].sort((a, b) => a.order - b.order))
  const dur = formatDuration(w.startedAt, w.endedAt)
  const vol = volumeKg(sets)
  const shown = groups.slice(0, 4)

  return (
    <Link to={`/history/${w.id}`} className="card block row-press">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-lg font-bold">{w.name}</span>
        <span className="shrink-0 text-sm text-mute">
          {new Date(w.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
      <div className="num mt-1 flex gap-4 text-sm text-mute">
        {dur && <span>⏱ {dur}</span>}
        {vol > 0 && <span>🏋 {formatVolume(Number(formatWeight(vol, units)))} {units}</span>}
        <span>{sets.filter(isHard).length} sets</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {shown.map((g) => {
          const ex = exercises.get(g.exerciseId)
          const best = bestSet(g.sets)
          return (
            <div key={g.exerciseId} className="flex items-center gap-3">
              <ExerciseThumb name={ex?.name ?? '?'} muscle={ex?.primaryMuscles[0]} size={40} />
              <div className="min-w-0 flex-1 truncate text-[15px]">
                <span className="text-mute">{g.sets.filter(isHard).length} × </span>{ex?.name}
              </div>
              <div className="num shrink-0 text-sm text-mute">{best ? fmtSet(best, units) : ''}</div>
            </div>
          )
        })}
        {groups.length > shown.length && <div className="text-sm text-mute">+ {groups.length - shown.length} more</div>}
      </div>
    </Link>
  )
}
