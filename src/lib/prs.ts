import type { WorkoutSet } from '../types'
import { e1rm, isHard } from './stats'

export interface PR { exerciseId: number; weightKg?: number; e1rmKg?: number }

/** Compares this workout's sets to everything logged before it. First-ever sessions are not PRs. */
export function detectPRs(current: WorkoutSet[], prior: WorkoutSet[]): PR[] {
  const out: PR[] = []
  for (const id of new Set(current.map((s) => s.exerciseId))) {
    const before = prior.filter((s) => s.exerciseId === id && isHard(s))
    if (!before.length) continue
    const now = current.filter((s) => s.exerciseId === id && isHard(s))
    const maxW = (l: WorkoutSet[]) => l.reduce((m, s) => Math.max(m, s.weightKg), 0)
    const maxE = (l: WorkoutSet[]) => l.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps)), 0)
    const pr: PR = { exerciseId: id }
    if (maxW(now) > maxW(before) + 1e-6) pr.weightKg = maxW(now)
    if (maxE(now) > maxE(before) + 1e-6) pr.e1rmKg = maxE(now)
    if (pr.weightKg !== undefined || pr.e1rmKg !== undefined) out.push(pr)
  }
  return out
}

export interface PREvent { exerciseId: number; date: number; workoutId: number; kind: 'weight' | 'e1rm'; weightKg: number; reps: number; e1rmKg: number }

/**
 * Walks history in order and emits an event whenever a session beats the previous best e1RM
 * (or heaviest weight). The very first session of an exercise sets the baseline, so it's not an event.
 */
export function prTimeline(sets: WorkoutSet[], starts: Map<number, number>): PREvent[] {
  const byWorkout = new Map<number, WorkoutSet[]>()
  for (const s of sets) if (isHard(s) && s.weightKg > 0 && starts.has(s.workoutId)) (byWorkout.get(s.workoutId) ?? byWorkout.set(s.workoutId, []).get(s.workoutId)!).push(s)
  const order = [...byWorkout.keys()].sort((a, b) => starts.get(a)! - starts.get(b)!)
  const best = new Map<number, { w: number; e: number }>()
  const out: PREvent[] = []
  for (const wid of order) {
    const perEx = new Map<number, WorkoutSet[]>()
    for (const s of byWorkout.get(wid)!) (perEx.get(s.exerciseId) ?? perEx.set(s.exerciseId, []).get(s.exerciseId)!).push(s)
    for (const [exId, list] of perEx) {
      const top = list.reduce((a, b) => (e1rm(b.weightKg, b.reps) > e1rm(a.weightKg, a.reps) ? b : a))
      const heavy = list.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))
      const cur = { w: heavy.weightKg, e: e1rm(top.weightKg, top.reps) }
      const prev = best.get(exId)
      if (prev) {
        const e1 = cur.e > prev.e + 1e-6, w1 = cur.w > prev.w + 1e-6
        if (e1 || w1) {
          const s = e1 ? top : heavy
          out.push({ exerciseId: exId, workoutId: wid, date: starts.get(wid)!, kind: e1 ? 'e1rm' : 'weight', weightKg: s.weightKg, reps: s.reps, e1rmKg: e1rm(s.weightKg, s.reps) })
        }
      }
      best.set(exId, { w: Math.max(cur.w, prev?.w ?? 0), e: Math.max(cur.e, prev?.e ?? 0) })
    }
  }
  return out
}

export interface Bests { weightKg: number; e1rmKg: number }

/** Live check while logging: does this set beat all-time bests and earlier sets in this session? */
export function livePR(bests: Bests | undefined, sessionSets: { weightKg: number; reps: number }[], weightKg: number, reps: number): 'weight' | 'e1rm' | null {
  if (!bests || weightKg <= 0 || reps <= 0) return null
  const maxW = Math.max(bests.weightKg, ...sessionSets.map((s) => s.weightKg))
  const maxE = Math.max(bests.e1rmKg, ...sessionSets.map((s) => e1rm(s.weightKg, s.reps)))
  if (e1rm(weightKg, reps) > maxE + 1e-6) return 'e1rm'
  if (weightKg > maxW + 1e-6) return 'weight'
  return null
}
