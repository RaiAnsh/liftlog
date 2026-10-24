import type { WorkoutSet } from '../types'

export interface SetTarget { weightKg: number; reps: number }
export type TargetKind = 'increase' | 'reps' | 'hold' | 'deload' | 'bodyweight'
export interface Target { sets: SetTarget[]; reason: string; kind: TargetKind }

export interface TargetOpts {
  repMin: number
  repMax: number
  incrementKg: number
  /** formats a kg weight in the user's unit, e.g. "135 lb" */
  fmt: (kg: number) => string
  /** the user picked "deload" on a plateau card and hasn't trained the lift since */
  deload?: boolean
}

/** Average RPE at or above this means "don't add weight yet", even if the reps were hit. */
export const RPE_HOLD = 9.5
const EPS = 0.01
const isWorking = (s: WorkoutSet) => s.completed && (s.type === 'working' || s.type === 'failure')
const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

/**
 * Double progression from last session's working sets (one target per last-session set):
 *  - every set at the top of the rep range with the same weight -> add one increment, back to the bottom of the range
 *  - otherwise keep each set's weight and add a rep on sets below the top of the range
 *  - average RPE >= 9.5 blocks a weight increase
 * Guidance only; returns null when there is no history to base it on.
 */
export function nextTarget(last: WorkoutSet[] | undefined, o: TargetOpts): Target | null {
  const sets = (last ?? []).filter(isWorking).sort((a, b) => a.order - b.order)
  if (!sets.length) return null
  const { repMin, repMax, incrementKg: inc, fmt } = o
  const list = sets.map((s) => s.reps).join('/')
  const w0 = sets[0].weightKg
  const allSame = sets.every((s) => Math.abs(s.weightKg - w0) < EPS)
  const hitMax = sets.every((s) => s.reps >= repMax)
  const rpes = sets.map((s) => s.rpe).filter((r): r is number => r !== null)
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null

  if (o.deload) {
    const lighter = sets.map((s) => {
      const r = Math.max(0, roundTo(s.weightKg * 0.9, inc))
      return { weightKg: r < s.weightKg - EPS ? r : Math.max(0, s.weightKg - inc), reps: Math.min(s.reps, repMax) }
    })
    return { kind: 'deload', sets: lighter, reason: `Deload: 10% lighter than last time (${fmt(w0)} → ${fmt(lighter[0].weightKg)}) to break the plateau` }
  }

  if (allSame && hitMax) {
    if (avgRpe !== null && avgRpe >= RPE_HOLD) {
      return {
        kind: 'hold', sets: sets.map(() => ({ weightKg: w0, reps: repMax })),
        reason: `You hit ${list} but RPE averaged ${avgRpe.toFixed(1)} → hold ${fmt(w0)} until it feels easier`,
      }
    }
    if (w0 < EPS) {
      return {
        kind: 'bodyweight', sets: sets.map(() => ({ weightKg: 0, reps: repMax })),
        reason: `You hit ${list} with bodyweight → add weight or a harder variation when you can`,
      }
    }
    return {
      kind: 'increase', sets: sets.map(() => ({ weightKg: w0 + inc, reps: repMin })),
      reason: `You hit ${list} last time → +${fmt(inc)}`,
    }
  }

  const detail = allSame ? `${fmt(w0)} × ${list}` : sets.map((s) => `${fmt(s.weightKg)}×${s.reps}`).join(', ')
  return {
    kind: 'reps', sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps < repMax ? s.reps + 1 : s.reps })),
    reason: `Last time ${detail} → add a rep on sets below ${repMax}`,
  }
}

/** Target for the i-th set of the workout; warm-ups have none, extra sets reuse the last target. */
export function targetForSet(target: Target | null | undefined, sets: { type: string }[], index: number): SetTarget | null {
  if (!target || sets[index].type === 'warmup') return null
  const k = sets.slice(0, index).filter((s) => s.type !== 'warmup').length
  return target.sets[Math.min(k, target.sets.length - 1)] ?? null
}

/** Did the logged set match or beat its target? Drives the subtle confirmation in the UI. */
export const metTarget = (set: { weightKg: number | null; reps: number | null }, t: SetTarget | null) =>
  !!t && set.weightKg !== null && set.reps !== null && set.weightKg >= t.weightKg - EPS && set.reps >= t.reps

/** "60 kg × 11/10/10" (or per-set weights when they differ). */
export function describeTarget(t: Target, fmt: (kg: number) => string): string {
  const w0 = t.sets[0].weightKg
  if (t.sets.every((s) => Math.abs(s.weightKg - w0) < EPS)) return `${fmt(w0)} × ${t.sets.map((s) => s.reps).join('/')}`
  return t.sets.map((s) => `${fmt(s.weightKg)} × ${s.reps}`).join(', ')
}
