import { MUSCLE_LABELS, type Exercise, type Muscle, type Routine, type Settings, type Workout, type WorkoutSet } from '../types'
import { MUSCLES } from '../types'
import { daysIntoWeek, emptyCounts, fmtSets, rangeFor, type MuscleCounts } from './volume'

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const lc = (m: Muscle) => MUSCLE_LABELS[m].toLowerCase()
export const joinList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** Which routine a workout belongs to: explicit routineId, else the same name (imported Strong workouts). */
export function matchRoutine(w: Workout, routines: Routine[]): Routine | null {
  if (w.routineId !== null) {
    const r = routines.find((x) => x.id === w.routineId)
    if (r) return r
  }
  const n = norm(w.name)
  return routines.find((r) => norm(r.name) === n) ?? null
}

/** The rotation: routines in your program (all routines when none are picked), in routine order. */
export function rotationOf(routines: Routine[], program: number[]): Routine[] {
  const sorted = [...routines].sort((a, b) => a.order - b.order)
  const picked = program.length ? sorted.filter((r) => program.includes(r.id!)) : sorted
  return picked.length ? picked : sorted
}

export interface Skip { routineId: number; at: number }

/** Next routine after whichever rotation routine you did (or skipped) most recently. */
export function nextInRotation(rot: Routine[], workouts: Workout[], routines: Routine[], lastSkip: Skip | null) {
  if (!rot.length) return null
  let last: { id: number; at: number } | null = null
  for (const w of workouts) {
    const r = matchRoutine(w, routines)
    if (r && rot.some((x) => x.id === r.id) && (!last || w.startedAt > last.at)) last = { id: r.id!, at: w.startedAt }
  }
  if (lastSkip && rot.some((x) => x.id === lastSkip.routineId) && (!last || lastSkip.at > last.at)) last = { id: lastSkip.routineId, at: lastSkip.at }
  if (!last) return { routine: rot[0], after: null as Routine | null }
  const i = rot.findIndex((r) => r.id === last!.id)
  return { routine: rot[(i + 1) % rot.length], after: rot[i] }
}

/** Planned hard sets per muscle if you did this routine as written. */
export function routineContribution(r: Routine, exercises: Map<number, Exercise>): MuscleCounts {
  const out = emptyCounts()
  for (const it of r.items) {
    const ex = exercises.get(it.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) out[m] += it.targetSets
    for (const m of ex.secondaryMuscles) out[m] += it.targetSets * 0.5
  }
  return out
}

const deficitOf = (m: Muscle, counts: MuscleCounts, targets: Settings['weeklyTargets']) => Math.max(0, rangeFor(m, targets).min - counts[m])

/** How many of this week's missing sets the routine would cover. */
function coverage(r: Routine, counts: MuscleCounts, targets: Settings['weeklyTargets'], exercises: Map<number, Exercise>) {
  const c = routineContribution(r, exercises)
  return MUSCLES.map((m) => ({ m, covered: Math.min(deficitOf(m, counts, targets), c[m]) })).filter((x) => x.covered > 0).sort((a, b) => b.covered - a.covered)
}

export interface Suggestion {
  routine: Routine
  reason: string
  alternative: { routine: Routine; reason: string } | null
}

export function suggestNext(o: {
  routines: Routine[]; program: number[]; workouts: Workout[]; lastSkip: Skip | null
  counts: MuscleCounts; targets: Settings['weeklyTargets']; exercises: Map<number, Exercise>
}): Suggestion | null {
  const rot = rotationOf(o.routines, o.program)
  const next = nextInRotation(rot, o.workouts, o.routines, o.lastSkip)
  if (!next) return null
  const cov = (r: Routine) => coverage(r, o.counts, o.targets, o.exercises)
  const sum = (xs: { covered: number }[]) => xs.reduce((n, x) => n + x.covered, 0)

  const mine = cov(next.routine)
  const reason = next.after ? `Next in your rotation after ${next.after.name}` : 'First in your rotation'

  let alternative: Suggestion['alternative'] = null
  let best: { r: Routine; c: ReturnType<typeof cov> } | null = null
  for (const r of rot) {
    if (r.id === next.routine.id) continue
    const c = cov(r)
    if (!best || sum(c) > sum(best.c)) best = { r, c }
  }
  // Only worth interrupting the rotation for a clear gain.
  if (best && sum(best.c) >= sum(mine) + 3) {
    const top = best.c.slice(0, 2).map((x) => lc(x.m))
    alternative = {
      routine: best.r,
      reason: `${best.r.name} would add ~${Math.round(sum(best.c))} sets toward ${joinList(top)}, under target this week`,
    }
  }
  return { routine: next.routine, reason, alternative }
}

export interface AtRisk { muscle: Muscle; current: number; min: number }

/** Muscles a routine mainly trains (primary work) that are below their weekly minimum right now. */
export function musclesAtRisk(r: Routine, counts: MuscleCounts, targets: Settings['weeklyTargets'], exercises: Map<number, Exercise>): AtRisk[] {
  const primary = new Set<Muscle>(r.items.flatMap((it) => (it.targetSets > 0 ? (exercises.get(it.exerciseId)?.primaryMuscles ?? []) : [])))
  return MUSCLES.filter((m) => primary.has(m) && counts[m] < rangeFor(m, targets).min)
    .map((m) => ({ muscle: m, current: counts[m], min: rangeFor(m, targets).min }))
    .sort((a, b) => (b.min - b.current) - (a.min - a.current))
}

const setsPhrase = (m: Muscle, n: number) => (n <= 0 ? `${lc(m)} with no sets` : `${lc(m)} at just ${fmtSets(n)} set${n === 1 ? '' : 's'}`)

/** "Skipping Legs leaves hamstrings at just 4 sets this week (10+ is a good week)." Null when nothing is at risk. */
export function skipWarning(r: Routine, counts: MuscleCounts, targets: Settings['weeklyTargets'], exercises: Map<number, Exercise>) {
  const risk = musclesAtRisk(r, counts, targets, exercises)
  if (!risk.length) return null
  const mins = new Set(risk.map((x) => x.min))
  const hint = mins.size === 1 ? ` (${[...mins][0]}+ sets is a good week)` : ''
  return { risk, text: `Skipping ${r.name} leaves ${joinList(risk.map((x) => setsPhrase(x.muscle, x.current)))} this week${hint}.` }
}

/** From the fifth day of the week on, say which muscles haven't been trained or are still building. */
export function lateWeekWarning(counts: MuscleCounts, targets: Settings['weeklyTargets'], now: number, startDay: 0 | 1) {
  if (daysIntoWeek(now, startDay) < 4) return null
  const under = MUSCLES.filter((m) => rangeFor(m, targets).max > 0 && counts[m] < rangeFor(m, targets).min)
    .map((m) => ({ muscle: m, current: counts[m], min: rangeFor(m, targets).min }))
    .sort((a, b) => (b.min - b.current) - (a.min - a.current))
  if (!under.length) return null
  const day = new Date(now).toLocaleDateString(undefined, { weekday: 'long' })
  const none = under.filter((x) => x.current <= 0).slice(0, 4)
  const some = under.filter((x) => x.current > 0).slice(0, 3)
  const parts: string[] = []
  if (none.length) parts.push(`${joinList(none.map((x) => lc(x.muscle)))} ${none.length === 1 ? 'hasn’t' : 'haven’t'} been trained yet`)
  if (some.length) parts.push(`${joinList(some.map((x) => `${lc(x.muscle)} (${fmtSets(x.current)} set${x.current === 1 ? '' : 's'})`))} ${some.length === 1 ? 'is' : 'are'} still building`)
  return { muscles: under, text: `It’s ${day}: ${parts.join('; ')} this week.` }
}

export interface Stale { muscle: Muscle; days: number }

/** Muscles trained in the last 90 days but not in the last 8+ days. */
export function staleMuscles(
  sets: WorkoutSet[], workouts: Workout[], exercises: Map<number, Exercise>, targets: Settings['weeklyTargets'], now: number,
): Stale[] {
  const start = new Map(workouts.map((w) => [w.id!, w.startedAt]))
  const last = new Map<Muscle, number>()
  for (const s of sets) {
    if (!s.completed || s.type === 'warmup') continue
    const t = start.get(s.workoutId), ex = exercises.get(s.exerciseId)
    if (t === undefined || !ex) continue
    for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) if (t > (last.get(m) ?? 0)) last.set(m, t)
  }
  const day = 86_400_000
  return [...last.entries()]
    .map(([muscle, t]) => ({ muscle, days: Math.floor((now - t) / day) }))
    .filter((x) => x.days >= 8 && x.days <= 90 && rangeFor(x.muscle, targets).max > 0)
    .sort((a, b) => b.days - a.days)
}
