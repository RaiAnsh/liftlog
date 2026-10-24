import type { SkipEntry } from '../types'
import type { Skip } from './suggest'

export const SKIP_REASONS = ['Tired', 'Busy', 'Sick', 'Injured', 'Rest day', 'Other'] as const

export function newSkip(name: string, routineId: number | null, reason: string | null, now: number): SkipEntry {
  return { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now, routineId, name, reason }
}

/** The most recent skip of a routine, which tells the rotation to move on. */
export function lastRotationSkip(log: SkipEntry[]): Skip | null {
  let best: Skip | null = null
  for (const s of log) if (s.routineId !== null && (!best || s.at > best.at)) best = { routineId: s.routineId, at: s.at }
  return best
}

export const skipsBetween = (log: SkipEntry[], from: number, to: number) => log.filter((s) => s.at >= from && s.at < to)

export const removeSkip = (log: SkipEntry[], id: string) => log.filter((s) => s.id !== id)
