import { sessionPoints } from '../lib/exerciseStats'
import { prTimeline } from '../lib/prs'
import type { Muscle, Settings, SkipEntry } from '../types'
import { MUSCLES } from '../types'
import { detectPlateau } from './plateau'
import type { History } from './types'
import { addDays, countMuscleSets, rangeFor, statusOf } from './volume'

export interface WeekSummary {
  weekStart: number
  sessions: number
  hardSets: number
  inRange: Muscle[]
  under: { muscle: Muscle; current: number; min: number }[]
  over: Muscle[]
  prs: number
  stalled: number[]
  skipped: number
}

/** The end-of-week card: what got done, where volume landed, records, and stalled lifts. */
export function weeklySummary(h: History, weekStart: number, targets: Settings['weeklyTargets'], now: number, skipLog: SkipEntry[] = [], o: { cutting?: boolean } = {}): WeekSummary {
  const end = addDays(weekStart, 7)
  const wks = h.workouts.filter((w) => w.startedAt >= weekStart && w.startedAt < end)
  const ids = new Set(wks.map((w) => w.id!))
  const counts = countMuscleSets(h.sets, h.workouts, h.exercises, weekStart, end)
  const status = MUSCLES.map((m) => ({ m, c: counts[m], r: rangeFor(m, targets) })).filter((x) => x.r.max > 0)

  const starts = new Map(h.workouts.map((w) => [w.id!, w.startedAt]))
  const prs = prTimeline(h.sets, starts).filter((p) => p.date >= weekStart && p.date < end).length

  const byEx = new Map<number, typeof h.sets>()
  for (const s of h.sets) (byEx.get(s.exerciseId) ?? byEx.set(s.exerciseId, []).get(s.exerciseId)!).push(s)
  const asOf = Math.min(now, end)
  const stalled: number[] = []
  for (const [id, sets] of o.cutting ? [] : byEx) {
    const pts = sessionPoints(sets, h.workouts.filter((w) => w.startedAt < end))
    if (pts.length && pts[pts.length - 1].date >= weekStart && detectPlateau(pts, asOf)) stalled.push(id)
  }

  return {
    weekStart, sessions: wks.length,
    hardSets: h.sets.filter((s) => ids.has(s.workoutId) && s.completed && s.type !== 'warmup').length,
    inRange: status.filter((x) => statusOf(x.c, x.r) === 'in').map((x) => x.m),
    under: status.filter((x) => statusOf(x.c, x.r) === 'under').map((x) => ({ muscle: x.m, current: x.c, min: x.r.min })),
    over: status.filter((x) => statusOf(x.c, x.r) === 'over').map((x) => x.m),
    prs, stalled, skipped: skipLog.filter((x) => x.at >= weekStart && x.at < end).length,
  }
}
