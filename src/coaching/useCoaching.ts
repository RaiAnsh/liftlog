import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { sessionPoints, type SessionPoint } from '../lib/exerciseStats'
import { useNow } from '../lib/useNow'
import type { Exercise, Settings, WorkoutSet } from '../types'
import { fatigueSignal } from './fatigue'
import { computeHighlights, lastTrained } from './highlights'
import { lastRotationSkip } from './skips'
import { weeklyTotals } from './volume'
import { detectPlateau, type Plateau } from './plateau'
import { weeklyAverages } from './hypertrophy'
import { lateWeekWarning, staleMuscles, suggestNext } from './suggest'
import type { History } from './types'
import { countMuscleSets, addDays, weekStartOf, weeklyBreakdown } from './volume'

export function useHistory(): History | undefined {
  return useLiveQuery(async () => {
    const [sets, workouts, exercises, routines] = await Promise.all([
      db.sets.toArray(), db.workouts.toArray(), db.exercises.toArray(), db.routines.orderBy('order').toArray(),
    ])
    return { sets, workouts, exercises: new Map(exercises.map((e) => [e.id!, e])), routines }
  })
}

export interface PlateauItem { exercise: Exercise; plateau: Plateau; points: SessionPoint[] }

export function compute(h: History, s: Settings, now: number) {
  const weekStart = weekStartOf(now, s.weekStartDay)
  const counts = countMuscleSets(h.sets, h.workouts, h.exercises, weekStart, addDays(weekStart, 7))
  const breakdown = weeklyBreakdown(h.sets, h.workouts, h.exercises, now, s.weekStartDay, 4)

  const byEx = new Map<number, WorkoutSet[]>()
  for (const x of h.sets) (byEx.get(x.exerciseId) ?? byEx.set(x.exerciseId, []).get(x.exerciseId)!).push(x)
  const plateaus: PlateauItem[] = []
  for (const [id, sets] of byEx) {
    const exercise = h.exercises.get(id)
    if (!exercise || exercise.archived) continue
    const points = sessionPoints(sets, h.workouts)
    const plateau = detectPlateau(points, now)
    // Cutting: holding your weights is the goal, so a flat lift isn't a problem worth flagging.
    if (plateau && s.phase !== 'cut' && s.coachState.dismissed[id] !== points.length) plateaus.push({ exercise, plateau, points })
  }
  plateaus.sort((a, b) => b.points[b.points.length - 1].date - a.points[a.points.length - 1].date)

  const usage = new Map([...byEx].map(([id, sets]) => [id, sets.length]))
  return {
    weekStart, counts, breakdown, plateaus, usage,
    avgWeekly: weeklyAverages(h, now, s.weekStartDay),
    last: lastTrained(h.sets, h.workouts, h.exercises),
    totals: weeklyTotals(h.sets, h.workouts, now, s.weekStartDay, 10),
    highlights: computeHighlights({ breakdown, sets: h.sets, workouts: h.workouts, exercises: h.exercises, targets: s.weeklyTargets, now }),
    suggestion: suggestNext({ routines: h.routines, program: s.program, workouts: h.workouts, lastSkip: lastRotationSkip(s.skipLog), counts, targets: s.weeklyTargets, exercises: h.exercises }),
    late: lateWeekWarning(counts, s.weeklyTargets, now, s.weekStartDay),
    stale: staleMuscles(h.sets, h.workouts, h.exercises, s.weeklyTargets, now),
    fatigue: fatigueSignal(h.sets, h.workouts, now),
  }
}

/** All coaching output for the current moment, recomputed when history, settings or the clock minute change. */
export function useCoaching() {
  const settings = useSettings()
  const h = useHistory()
  const now = useNow(60_000)
  const out = useMemo(() => (h ? compute(h, settings, now) : null), [h, settings, now])
  return { h, settings, now, c: out }
}
