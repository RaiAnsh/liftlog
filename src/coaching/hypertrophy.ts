import { locate } from '../lib/exerciseGroups'
import { MUSCLE_LABELS, MUSCLES, type ActiveWorkout, type Exercise, type Muscle, type Settings, type Tier, type WorkoutSet } from '../types'
import { routineContribution } from './suggest'
import type { History } from './types'
import { addDays, countMuscleSets, emptyCounts, fmtSets, rangeFor, weekStartOf, type MuscleCounts } from './volume'

/** Which research summary (src/data/science.ts) backs a piece of advice. */
export type SciId = 'volume' | 'effort' | 'load' | 'rest' | 'frequency' | 'session' | 'maintenance'

export interface Advice {
  id: string
  kind: 'effort' | 'rest' | 'load' | 'add-set' | 'trim-set' | 'split'
  text: string
  sci: SciId
}

const lc = (m: Muscle) => MUSCLE_LABELS[m].toLowerCase()
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const isWorking = (s: WorkoutSet) => s.completed && (s.type === 'working' || s.type === 'failure')

export const THRESHOLDS = {
  /** average RPE below this on last session's sets suggests they were too easy */
  easyRpe: 7,
  /** median reps at/above this means the weight was very light; at/below means very heavy */
  highReps: 20,
  lowReps: 3,
  /** reps fell to this share of the first set's reps at the same weight: fatigue accumulating fast */
  dropoff: 0.7,
  /** hard sets for one muscle in a single session beyond which each extra set tends to add less */
  sessionCap: 10,
  /** add sets when the muscle averages below this share of its weekly minimum */
  shortOfGoal: 0.85,
  /** trim when it averages above this multiple of its weekly maximum */
  overGoal: 1.15,
}

/**
 * Up to two plain-language "next time" tips for one exercise, from last session's sets, how much work
 * its muscle really gets in a typical week, and (while planning a workout) how much you've stacked into one session.
 * Order of importance: effort, rest, load, add a set, trim a set, split across days.
 */
export function exerciseAdvice(o: {
  exercise: Exercise
  last: WorkoutSet[] | undefined
  avgWeekly: MuscleCounts | null
  targets: Settings['weeklyTargets']
  plannedToday?: number
}): Advice[] {
  const ex = o.exercise
  const sets = (o.last ?? []).filter(isWorking).sort((a, b) => a.order - b.order)
  const out: Advice[] = []
  const muscle = ex.primaryMuscles[0]

  if (sets.length) {
    const rpes = sets.map((s) => s.rpe).filter((r): r is number => r !== null)
    if (rpes.length >= 2) {
      const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length
      if (avg < THRESHOLDS.easyRpe) out.push({ id: `${ex.id}-effort`, kind: 'effort', sci: 'effort', text: `Last time felt easy (RPE ${avg.toFixed(1)}). Add weight or reps: growth sets work best when you finish with roughly 0–3 reps left.` })
    }

    const sameWeight = sets.filter((s) => Math.abs(s.weightKg - sets[0].weightKg) <= sets[0].weightKg * 0.01)
    if (sameWeight.length >= 3 && sameWeight[0].reps >= 6) {
      const first = sameWeight[0].reps, lastReps = sameWeight[sameWeight.length - 1].reps
      if (lastReps <= first * THRESHOLDS.dropoff) out.push({ id: `${ex.id}-rest`, kind: 'rest', sci: 'rest', text: `Reps fell from ${first} to ${lastReps} across sets. Try resting 2–3 minutes (or dropping the weight a little) so later sets stay productive.` })
    }

    const m = median(sets.map((s) => s.reps))
    if (sets[0].weightKg > 0 && m >= THRESHOLDS.highReps) out.push({ id: `${ex.id}-heavy`, kind: 'load', sci: 'load', text: `Your reps were high (typically ${Math.round(m)}). A heavier weight gets you hard sets in about 8–15 reps with less grinding.` })
    else if (m <= THRESHOLDS.lowReps && m > 0) out.push({ id: `${ex.id}-light`, kind: 'load', sci: 'load', text: `Those were very low reps (typically ${Math.round(m)}). For muscle growth, a slightly lighter weight for 6–12 reps usually works just as well.` })

    if (muscle && o.avgWeekly) {
      const r = rangeFor(muscle, o.targets)
      const avg = o.avgWeekly[muscle]
      const allProductive = sets.every((s) => s.reps >= ex.repRangeMin)
      if (avg < r.min * THRESHOLDS.shortOfGoal && sets.length < 5 && allProductive) {
        out.push({ id: `${ex.id}-add`, kind: 'add-set', sci: 'volume', text: `Add a set next time. Your ${lc(muscle)} average about ${fmtSets(Math.round(avg * 2) / 2)} sets a week, short of the ${r.min}+ your goal calls for.` })
      } else if (avg > r.max * THRESHOLDS.overGoal && sets.length >= 4) {
        out.push({ id: `${ex.id}-trim`, kind: 'trim-set', sci: 'volume', text: `You can drop a set here. Your ${lc(muscle)} average about ${fmtSets(Math.round(avg * 2) / 2)} sets a week, above your goal's ${r.max}; extra sets add little and cost recovery.` })
      }
    }
  }

  if (muscle && (o.plannedToday ?? 0) > THRESHOLDS.sessionCap) {
    out.push({ id: `${ex.id}-split`, kind: 'split', sci: 'session', text: `That's ${fmtSets(o.plannedToday!)} sets for ${lc(muscle)} in one session. Later sets tend to add less; consider moving some to another day.` })
  }

  const order: Advice['kind'][] = ['effort', 'rest', 'load', 'add-set', 'trim-set', 'split']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, 2)
}

export interface WeeklyAverages {
  /** average hard sets per muscle per training week */
  avg: MuscleCounts
  /** average number of separate sessions per week that trained the muscle (2+ primary sets) */
  sessions: MuscleCounts
  weekStarts: number[]
}

/**
 * Averages over your most recent complete training weeks (up to 4), skipping weeks you didn't train so a
 * holiday doesn't drag everything to zero. Null when there are fewer than 2 such weeks to learn from.
 */
export function weeklyAverages(h: History, now: number, startDay: 0 | 1, wanted = 4, lookback = 20): WeeklyAverages | null {
  const current = weekStartOf(now, startDay)
  const weeks: number[] = []
  for (let i = 1; i <= lookback && weeks.length < wanted; i++) {
    const ws = addDays(current, -7 * i)
    const c = countMuscleSets(h.sets, h.workouts, h.exercises, ws, addDays(ws, 7))
    if (MUSCLES.some((m) => c[m] > 0)) weeks.push(ws)
  }
  if (weeks.length < 2) return null

  const avg = emptyCounts(), sessions = emptyCounts()
  const primaryByWorkout = new Map<number, Map<Muscle, number>>()
  for (const s of h.sets) {
    if (!s.completed || s.type === 'warmup') continue
    const ex = h.exercises.get(s.exerciseId)
    if (!ex) continue
    const m = primaryByWorkout.get(s.workoutId) ?? primaryByWorkout.set(s.workoutId, new Map()).get(s.workoutId)!
    for (const p of ex.primaryMuscles) m.set(p, (m.get(p) ?? 0) + 1)
  }
  for (const ws of weeks) {
    const c = countMuscleSets(h.sets, h.workouts, h.exercises, ws, addDays(ws, 7))
    for (const m of MUSCLES) avg[m] += c[m] / weeks.length
    for (const w of h.workouts) {
      if (w.startedAt < ws || w.startedAt >= addDays(ws, 7)) continue
      for (const [m, n] of primaryByWorkout.get(w.id!) ?? []) if (n >= 2) sessions[m] += 1 / weeks.length
    }
  }
  return { avg, sessions, weekStarts: weeks }
}

export interface Candidate { key: string; name: string; muscles: Muscle[]; mine: boolean; sets: number }
export interface Fix { routineId: number; routineName: string; exerciseKey: string; exerciseName: string; sets: number }
export interface ReviewItem {
  id: string
  kind: 'add' | 'frequency' | 'trim'
  muscle: Muscle
  tier: Tier | null
  title: string
  detail: string
  sci: SciId
  fix: Fix | null
}

const TIER_RANK: Record<string, number> = { priority: 0, standard: 1, light: 2 }

/** Picks the template that best fits a muscle (same Push/Pull/Legs/Core group) and an exercise to add to it. */
export function chooseFix(muscle: Muscle, gap: number, h: History, candidates: Candidate[]): Fix | null {
  const group = locate([muscle]).group
  let best: { r: History['routines'][number]; fit: number; total: number } | null = null
  for (const r of h.routines) {
    const c = routineContribution(r, h.exercises)
    const fit = MUSCLES.filter((m) => locate([m]).group.id === group.id).reduce((n, m) => n + c[m], 0)
    const total = r.items.reduce((n, i) => n + i.targetSets, 0)
    if (!best || fit > best.fit || (fit === best.fit && total < best.total)) best = { r, fit, total }
  }
  if (!best) return null
  const inRoutine = new Set(best.r.items.map((i) => h.exercises.get(i.exerciseId)?.nameKey))
  const pick = candidates
    .filter((c) => c.muscles.includes(muscle) && !inRoutine.has(c.key))
    .sort((a, b) => Number(b.muscles[0] === muscle) - Number(a.muscles[0] === muscle) || Number(b.mine) - Number(a.mine) || b.sets - a.sets)[0]
  if (!pick) return null
  return { routineId: best.r.id!, routineName: best.r.name, exerciseKey: pick.key, exerciseName: pick.name, sets: Math.min(4, Math.max(2, Math.ceil(gap / 2))) }
}

/**
 * Looks at what you actually did over your last few training weeks and flags muscles that are short of your
 * goal, bunched into one session a week, or getting more than a low-priority muscle needs. Where it can, it
 * proposes a concrete edit: "add 3 sets of Lateral Raise to Push".
 */
export function programReview(o: {
  h: History; goal: Settings['goal']; targets: Settings['weeklyTargets']; now: number; startDay: 0 | 1; candidates: Candidate[]; limit?: number
}): { items: ReviewItem[]; weeks: number; from: number; to: number } | null {
  const wa = weeklyAverages(o.h, o.now, o.startDay)
  if (!wa) return null
  const items: ReviewItem[] = []

  for (const m of MUSCLES) {
    const r = rangeFor(m, o.targets)
    if (r.max <= 0) continue
    const tier = o.goal ? o.goal.tiers[m] : null
    const avg = wa.avg[m], per = wa.sessions[m]
    const gap = r.min - avg

    if (tier !== 'light' && gap >= 2) {
      items.push({
        id: `add-${m}`, kind: 'add', muscle: m, tier, sci: 'volume',
        title: `${MUSCLE_LABELS[m]} needs more work`,
        detail: `You average ${fmtSets(Math.round(avg * 2) / 2)} sets a week; your goal calls for ${r.min}–${r.max}.`,
        fix: chooseFix(m, gap, o.h, o.candidates),
      })
    } else if (tier !== 'light' && avg >= 10 && per < 1.4) {
      items.push({
        id: `freq-${m}`, kind: 'frequency', muscle: m, tier, sci: 'session',
        title: `Spread ${lc(m)} over two days`,
        detail: `Most of your ${fmtSets(Math.round(avg))} weekly sets happen in a single session. Splitting them keeps each set productive.`,
        fix: null,
      })
    } else if (tier === 'light' && avg > r.max * 1.5) {
      items.push({
        id: `trim-${m}`, kind: 'trim', muscle: m, tier, sci: 'maintenance',
        title: `${MUSCLE_LABELS[m]} is getting more than it needs`,
        detail: `${fmtSets(Math.round(avg))} sets a week for a maintain-level muscle. Trimming frees recovery for your priorities.`,
        fix: null,
      })
    }
  }
  items.sort((a, b) => (TIER_RANK[a.tier ?? 'standard'] - TIER_RANK[b.tier ?? 'standard']) || a.kind.localeCompare(b.kind))
  return { items: items.slice(0, o.limit ?? 5), weeks: wa.weekStarts.length, from: Math.min(...wa.weekStarts), to: addDays(Math.max(...wa.weekStarts), 6) }
}

/** Sets planned in the current workout that hit a muscle (primary 1, secondary 0.5; warm-ups excluded). */
export function plannedSetsFor(d: ActiveWorkout, exercises: Map<number, Exercise>, muscle: Muscle): number {
  let n = 0
  for (const e of d.exercises) {
    const ex = exercises.get(e.exerciseId)
    if (!ex) continue
    const sets = e.sets.filter((s) => s.type !== 'warmup').length
    if (ex.primaryMuscles.includes(muscle)) n += sets
    else if (ex.secondaryMuscles.includes(muscle)) n += sets * 0.5
  }
  return n
}
