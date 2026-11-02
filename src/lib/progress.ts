import { e1rm } from './stats'

export interface Perf { weightKg: number; reps: number }
export type Tone = 'up' | 'same' | 'down'

/**
 * One number for "how did this exercise go": your best estimated 1RM (sets of 12 reps or fewer), falling back to
 * total volume (weight x reps), and for bodyweight work to total reps.
 */
function score(sets: Perf[]): { kind: 'e1rm' | 'volume' | 'reps'; v: number } | null {
  const work = sets.filter((s) => s.reps > 0)
  if (!work.length) return null
  const best = work.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps)), 0)
  if (best > 0) return { kind: 'e1rm', v: best }
  const vol = work.reduce((n, s) => n + s.weightKg * s.reps, 0)
  if (vol > 0) return { kind: 'volume', v: vol }
  return { kind: 'reps', v: work.reduce((n, s) => n + s.reps, 0) }
}

/** Percent change versus last time, or null when there is nothing comparable. 0 means you matched it exactly. */
export function progressPct(prev: Perf[] | undefined, cur: Perf[]): number | null {
  if (!prev?.length) return null
  const a = score(prev), b = score(cur)
  if (!a || !b || a.v <= 0) return null
  // Mixed kinds (e.g. high-rep last time, e1RM now) are compared on volume so the number stays honest.
  if (a.kind !== b.kind) {
    const va = prev.filter((s) => s.reps > 0).reduce((n, s) => n + (s.weightKg || 1) * s.reps, 0)
    const vb = cur.filter((s) => s.reps > 0).reduce((n, s) => n + (s.weightKg || 1) * s.reps, 0)
    return va > 0 ? Math.round(((vb - va) / va) * 100) : null
  }
  return Math.round(((b.v - a.v) / a.v) * 100)
}

export function progressLabel(pct: number, cutting = false): { text: string; tone: Tone } {
  if (pct > 0) return { text: `▲ ${pct}% vs last time`, tone: 'up' }
  if (pct < 0) return { text: `▼ ${Math.abs(pct)}% vs last time`, tone: cutting && pct >= -5 ? 'same' : 'down' }
  return { text: cutting ? '✓ matched last time' : '= 0% vs last time', tone: 'same' }
}
