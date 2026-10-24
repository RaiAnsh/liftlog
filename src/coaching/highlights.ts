import { sessionPoints } from '../lib/exerciseStats'
import { MUSCLE_LABELS, type Exercise, type Muscle, type Settings, type Workout, type WorkoutSet } from '../types'
import { MUSCLES } from '../types'
import { fmtSets, rangeFor, type MuscleCounts } from './volume'

const DAY = 86_400_000

export interface Highlight { muscle: Muscle; title: string; detail: string }
export interface LiftHighlight { exerciseId: number; pct: number; fromKg: number; toKg: number; weeks: number }
export interface Highlights { best: Highlight | null; improve: Highlight | null; lift: LiftHighlight | null; periodLabel: string }

/** When each muscle last had a completed non-warm-up set (primary or secondary). */
export function lastTrained(sets: WorkoutSet[], workouts: Workout[], exercises: Map<number, Exercise>): Map<Muscle, number> {
  const start = new Map(workouts.map((w) => [w.id!, w.startedAt]))
  const out = new Map<Muscle, number>()
  for (const s of sets) {
    if (!s.completed || s.type === 'warmup') continue
    const t = start.get(s.workoutId), ex = exercises.get(s.exerciseId)
    if (t === undefined || !ex) continue
    for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) if (t > (out.get(m) ?? 0)) out.set(m, t)
  }
  return out
}

const lc = (m: Muscle) => MUSCLE_LABELS[m]
const total = (c: MuscleCounts) => MUSCLES.reduce((n, m) => n + c[m], 0)

/**
 * Friendly, relative insights instead of raw x/10 numbers:
 *  - best: the muscle you've worked hardest relative to its target, compared with your own usual
 *  - improve: the muscle that most needs attention (longest untrained while under target)
 *  - lift: the lift whose estimated 1RM rose the most over the last 8 weeks
 * Early in a week (little logged yet) it talks about last week instead of calling everything "behind".
 */
export function computeHighlights(o: {
  breakdown: { weekStart: number; counts: MuscleCounts }[]
  sets: WorkoutSet[]; workouts: Workout[]; exercises: Map<number, Exercise>
  targets: Settings['weeklyTargets']; now: number
}): Highlights {
  const { breakdown, targets, now } = o
  const curIdx = breakdown.length - 1
  const useLast = total(breakdown[curIdx].counts) < 6 && curIdx > 0 && total(breakdown[curIdx - 1].counts) > 0
  const refIdx = useLast ? curIdx - 1 : curIdx
  const ref = breakdown[refIdx].counts
  const periodLabel = useLast ? 'last week' : 'this week'
  const earlier = breakdown.slice(0, refIdx)
  const usual = (m: Muscle) => (earlier.length ? earlier.reduce((n, w) => n + w.counts[m], 0) / earlier.length : 0)
  const last = lastTrained(o.sets, o.workouts, o.exercises)
  const daysSince = (m: Muscle) => (last.has(m) ? Math.floor((now - last.get(m)!) / DAY) : null)

  let best: Highlight | null = null
  let bestScore = 0
  for (const m of MUSCLES) {
    const r = rangeFor(m, targets)
    if (r.max <= 0 || ref[m] <= 0) continue
    const score = ref[m] / Math.max(r.min, 1) + ref[m] / 1000
    if (score > bestScore) {
      bestScore = score
      const u = usual(m)
      best = {
        muscle: m, title: `${lc(m)} is your strongest area`,
        detail: `${fmtSets(ref[m])} sets ${periodLabel}${u >= 1 ? `, your usual is ${Math.round(u)}` : ''}`,
      }
    }
  }

  let improve: Highlight | null = null
  let worst = -1
  for (const m of MUSCLES) {
    const r = rangeFor(m, targets)
    const d = daysSince(m)
    if (r.max <= 0 || d === null || d > 120 || ref[m] >= r.min) continue
    if (d > worst) {
      worst = d
      improve = {
        muscle: m, title: `${lc(m)} needs attention`,
        detail: d >= 8 ? `Not trained in ${d} days` : ref[m] > 0 ? `Only ${fmtSets(ref[m])} sets ${periodLabel}` : `Haven’t hit it ${periodLabel}`,
      }
    }
  }

  const byEx = new Map<number, WorkoutSet[]>()
  for (const s of o.sets) (byEx.get(s.exerciseId) ?? byEx.set(s.exerciseId, []).get(s.exerciseId)!).push(s)
  let lift: LiftHighlight | null = null
  for (const [id, sets] of byEx) {
    const pts = sessionPoints(sets, o.workouts).filter((p) => p.date >= now - 56 * DAY && p.e1rmKg > 0)
    if (pts.length < 2) continue
    const first = pts[0].e1rmKg
    const top = pts.slice(1).reduce((a, b) => (b.e1rmKg > a.e1rmKg ? b : a))
    const pct = (top.e1rmKg - first) / first
    if (pct >= 0.03 && (!lift || pct > lift.pct)) lift = { exerciseId: id, pct, fromKg: first, toKg: top.e1rmKg, weeks: Math.max(1, Math.round((top.date - pts[0].date) / (7 * DAY))) }
  }

  return { best, improve, lift, periodLabel }
}
