import type { SetTarget } from '../coaching/targets'
import { metTarget } from '../coaching/targets'
import type { ActiveWorkout } from '../types'

/** Did this set count as "on target"? With no target (a new exercise), reaching the bottom of the rep range counts. */
export function isHit(set: { weightKg: number | null; reps: number | null }, target: SetTarget | null, repMin: number | null): boolean {
  if (target) return metTarget(set, target)
  return (set.reps ?? 0) > 0 && (set.reps ?? 0) >= (repMin ?? 1)
}

/**
 * Sets in a row, most recent first, that were on target. Warm-ups are ignored (they neither build nor
 * break a streak); a completed working set that misses its target ends it.
 */
export function streakOf(d: ActiveWorkout): number {
  const done = d.exercises.flatMap((e) => e.sets).filter((s) => s.completed && s.type !== 'warmup' && s.doneAt !== undefined)
    .sort((a, b) => b.doneAt! - a.doneAt!)
  let n = 0
  for (const s of done) {
    if (!s.hit) break
    n++
  }
  return n
}

export interface Fire { level: 1 | 2 | 3; title: string; sub: string }

/** Streak milestones: 3 in a row, 5, 8, then every 4 more. A new PR always lights it up (at least level 2). */
export function fireFor(streak: number, pr: boolean): Fire | null {
  const milestone = streak === 3 ? 1 : streak === 5 ? 2 : streak >= 8 && (streak - 8) % 4 === 0 ? 3 : 0
  if (pr) {
    const level = Math.max(2, milestone) as 2 | 3
    return { level, title: 'NEW PR!', sub: streak >= 2 ? `And ${streak} on target in a row` : 'Best estimated 1RM yet' }
  }
  if (milestone === 1) return { level: 1, title: 'YOU’RE ON FIRE!', sub: '3 sets in a row on target' }
  if (milestone === 2) return { level: 2, title: 'UNSTOPPABLE!', sub: '5 in a row. Keep it rolling' }
  if (milestone === 3) return { level: 3, title: 'INFERNO!', sub: `${streak} in a row. Absolutely locked in` }
  return null
}

const PHRASES = ['Breathe. Next set is yours.', 'Shake it out.', 'You came here to work.', 'Stay locked in.', 'Make this one count.', 'Strong. Keep going.', 'Own the next one.', 'Earn it.']
/** A short line for the rest timer; stable for a given number of completed sets. */
export const restPhrase = (completedSets: number) => PHRASES[completedSets % PHRASES.length]
