import { isCardio } from '../db/exercises'
import type { Exercise, Phase, Workout, WorkoutSet } from '../types'

const DAY = 86_400_000
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

export interface Recommendation {
  id: string
  emoji: string
  title: string
  detail: string
  action?: { kind: 'cardio'; name: string; label: string } | { kind: 'template'; routineId: number; label: string }
}

/** Cardio sessions and minutes in the last `days` days. */
export function cardioStats(h: { sets: WorkoutSet[]; workouts: Workout[]; exercises: Map<number, Exercise> }, now: number, days = 7) {
  const recent = new Map(h.workouts.filter((w) => now - w.startedAt < days * DAY && w.startedAt <= now).map((w) => [w.id!, w]))
  const sessions = new Set<number>()
  let seconds = 0
  for (const s of h.sets) {
    const ex = h.exercises.get(s.exerciseId)
    if (!s.completed || !ex || !isCardio(ex) || !recent.has(s.workoutId)) continue
    sessions.add(s.workoutId)
    seconds += s.seconds
  }
  return { sessions: sessions.size, minutes: Math.round(seconds / 60) }
}

/** Consecutive days with a workout, counting back from today (or from yesterday if you haven't trained yet today). */
export function trainingStreak(workouts: Workout[], now: number): number {
  let n = 0
  let day = now
  if (!workouts.some((w) => sameDay(w.startedAt, day))) day -= DAY
  while (workouts.some((w) => sameDay(w.startedAt, day))) { n++; day -= DAY }
  return n
}

/**
 * A couple of "recommended for you" nudges: rest after a long run of training days, easy cardio when cutting (or
 * a little for general health otherwise), and the workout that fixes your most under-trained priority muscle.
 */
export function recommend(o: {
  phase: Phase
  cardio: { sessions: number; minutes: number }
  streakDays: number
  hasHistory: boolean
  laggard?: { routineId: number; routineName: string; muscleLabel: string } | null
}): Recommendation[] {
  if (!o.hasHistory) return []
  const out: Recommendation[] = []
  if (o.streakDays >= 4) {
    out.push({ id: 'rest', emoji: '😴', title: 'Take a rest day', detail: `You've trained ${o.streakDays} days in a row. Muscle is built while you recover, and a day off usually makes the next session better.` })
  }
  if (o.phase === 'cut' && o.cardio.sessions < 2) {
    out.push({
      id: 'cardio-cut', emoji: '🚶', title: 'Add some easy cardio',
      detail: `On a cut, 2–3 easy sessions a week (like a 25-minute incline walk) add calorie burn without costing much recovery. You've logged ${o.cardio.sessions} in the last 7 days.`,
      action: { kind: 'cardio', name: 'Incline Walk (Treadmill)', label: 'Start incline walk' },
    })
  }
  if (o.laggard && o.phase !== 'cut') {
    out.push({
      id: 'laggard', emoji: '🎯', title: `Prioritise ${o.laggard.muscleLabel.toLowerCase()}`,
      detail: `It's your most under-trained priority muscle. ${o.laggard.routineName} is the workout that hits it.`,
      action: { kind: 'template', routineId: o.laggard.routineId, label: `Start ${o.laggard.routineName}` },
    })
  }
  if (o.phase !== 'cut' && o.cardio.minutes < 60 && out.length < 2) {
    out.push({
      id: 'cardio-health', emoji: '❤️', title: 'A little cardio goes a long way',
      detail: `The general health guideline is around 150 minutes of moderate activity a week. You've logged ${o.cardio.minutes} min of cardio in the last 7 days; an easy 20-minute walk or bike counts.`,
      action: { kind: 'cardio', name: 'Walking (Treadmill)', label: 'Start a walk' },
    })
  }
  return out.slice(0, 2)
}
