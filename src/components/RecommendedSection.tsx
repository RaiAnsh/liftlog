import { useMemo } from 'react'
import { programReview } from '../coaching/hypertrophy'
import { cardioStats, recommend, trainingStreak } from '../coaching/recommend'
import type { History } from '../coaching/types'
import { useExerciseItems } from '../lib/useExerciseItems'
import { startCardio } from '../workout/actions'
import { startFromRoutine } from '../workout/draft'
import { startDraft } from '../workout/store'
import { MUSCLE_LABELS, type Settings } from '../types'

/** "Recommended for you": at most two nudges (rest, easy cardio on a cut, the workout for your most under-trained muscle). */
export default function RecommendedSection({ h, settings, now }: { h: History; settings: Settings; now: number }) {
  const items = useExerciseItems()
  const recs = useMemo(() => {
    const review = programReview({
      h, goal: settings.goal, targets: settings.weeklyTargets, now, startDay: settings.weekStartDay, phase: settings.phase, limit: 50,
      candidates: (items ?? []).map((i) => ({ key: i.key, name: i.name, muscles: i.muscles, mine: i.mine, sets: i.sets })),
    })
    const top = review?.items.find((i) => i.kind === 'add' && i.tier === 'priority' && i.fix)
    return recommend({
      phase: settings.phase, cardio: cardioStats(h, now), streakDays: trainingStreak(h.workouts, now), hasHistory: h.workouts.length > 0,
      laggard: top?.fix ? { routineId: top.fix.routineId, routineName: top.fix.routineName, muscleLabel: MUSCLE_LABELS[top.muscle] } : null,
    })
  }, [h, settings.goal, settings.weeklyTargets, settings.weekStartDay, settings.phase, now, items])

  if (!recs.length) return null
  return (
    <section className="space-y-2">
      <div className="label">Recommended for you</div>
      {recs.map((r, i) => (
        <div key={r.id} className="rise card flex items-start gap-3" style={{ ['--i' as string]: i }}>
          <span className="text-2xl" aria-hidden>{r.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-tight">{r.title}</div>
            <div className="mt-0.5 text-sm text-mute">{r.detail}</div>
            {r.action && (
              <button className="btn press mt-2 !min-h-[40px] !px-4 !text-[15px]" onClick={() => {
                const a = r.action!
                if (a.kind === 'cardio') void startCardio(a.name, settings.units)
                else { const routine = h.routines.find((x) => x.id === a.routineId); if (routine) startDraft(startFromRoutine(routine, h.exercises, Date.now())) }
              }}>{r.action.label}</button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
