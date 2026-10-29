import { db as defaultDb, type LiftLogDB } from '../db/db'
import { nameKey } from '../db/exercises'
import type { Exercise, Routine, Workout, WorkoutSet } from '../types'

export interface CandidateItem { exerciseId: number; name: string; sets: number; repMin: number; repMax: number }
export interface TemplateCandidate {
  /** normalised workout name, used to remember your answer */
  key: string
  /** how it should be named as a template */
  name: string
  sessions: number
  lastAt: number
  items: CandidateItem[]
}

const DAY = 86_400_000
/** Names apps give a workout when you didn't name it: not templates. */
const DEFAULT_NAME = /^(?:(?:early )?(?:morning|midday|lunch|afternoon|evening|night|late night)\s+)?workout(?:\s*\d*)?$|^(?:new|empty|quick)\s+workout$/i

export const normName = (n: string) => nameKey(n)

const isWork = (s: WorkoutSet) => s.completed && s.type !== 'warmup'
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }

/** "push" -> "Push", but keeps names you already capitalised ("Upper A"). Uses the spelling you used most. */
function displayName(variants: string[]): string {
  const count = new Map<string, number>()
  for (const v of variants) count.set(v.trim(), (count.get(v.trim()) ?? 0) + 1)
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return best === best.toLowerCase() ? best.replace(/\b\w/g, (c) => c.toUpperCase()) : best
}

/** A rep range around what you actually do: the usual 8-12, unless your typical reps live elsewhere. */
function repRange(typical: number): { repMin: number; repMax: number } {
  const m = Math.round(typical)
  if (m >= 6 && m <= 12) return { repMin: 8, repMax: 12 }
  const repMin = Math.min(30, Math.max(1, m - 2))
  return { repMin, repMax: Math.min(40, Math.max(repMin + 2, m + 3)) }
}

export const OFFER_MIN_SESSIONS = 3
export const OFFER_MAX_AGE_DAYS = 365

/**
 * Finds the workouts you keep doing under the same name and turns the most recent one into a template:
 * its exercises in order, your usual number of working sets, and a rep range matching your reps.
 * Works from whatever history is on the phone, so it suits any Strong export.
 * Default names ("Afternoon Workout"), one-offs, and (by default) workouts you haven't done in a year are ignored.
 */
export function inferTemplates(
  h: { workouts: Workout[]; sets: WorkoutSet[]; exercises: Map<number, Exercise> },
  o: { now: number; minSessions?: number; maxAgeDays?: number; limit?: number } = { now: Date.now() },
): TemplateCandidate[] {
  const minSessions = o.minSessions ?? OFFER_MIN_SESSIONS
  const maxAge = o.maxAgeDays ?? OFFER_MAX_AGE_DAYS
  const setsBy = new Map<number, WorkoutSet[]>()
  for (const s of h.sets) if (isWork(s)) (setsBy.get(s.workoutId) ?? setsBy.set(s.workoutId, []).get(s.workoutId)!).push(s)

  const groups = new Map<string, Workout[]>()
  for (const w of h.workouts) {
    const raw = w.name.trim()
    if (!raw || DEFAULT_NAME.test(raw) || !setsBy.has(w.id!)) continue
    ;(groups.get(normName(raw)) ?? groups.set(normName(raw), []).get(normName(raw))!).push(w)
  }

  const out: TemplateCandidate[] = []
  for (const [key, ws] of groups) {
    const sorted = [...ws].sort((a, b) => b.startedAt - a.startedAt)
    if (sorted.length < minSessions || o.now - sorted[0].startedAt > maxAge * DAY) continue

    const latest = (setsBy.get(sorted[0].id!) ?? []).sort((a, b) => a.order - b.order)
    const order: number[] = []
    for (const s of latest) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)

    const recent = sorted.slice(0, 5)
    const items: CandidateItem[] = []
    for (const id of order) {
      const ex = h.exercises.get(id)
      if (!ex) continue
      const inLatest = latest.filter((s) => s.exerciseId === id).length
      const reps = recent.flatMap((w) => (setsBy.get(w.id!) ?? []).filter((s) => s.exerciseId === id && s.reps > 0).map((s) => s.reps))
      items.push({ exerciseId: id, name: ex.name, sets: Math.min(6, Math.max(1, inLatest)), ...repRange(reps.length ? median(reps) : 10) })
    }
    if (!items.length) continue
    out.push({ key, name: displayName(ws.map((w) => w.name)), sessions: sorted.length, lastAt: sorted[0].startedAt, items: items.slice(0, 12) })
  }
  // Most-done, most-recent first.
  out.sort((a, b) => b.sessions - a.sessions || b.lastAt - a.lastAt)
  return out.slice(0, o.limit ?? 8)
}

/** Drops candidates you already have a template for, or already answered (unless asked to include declined). */
export function pendingOffers(c: TemplateCandidate[], routines: Routine[], choices: Record<string, 'added' | 'declined'>, includeDeclined = false): TemplateCandidate[] {
  const have = new Set(routines.map((r) => normName(r.name)))
  return c.filter((x) => !have.has(x.key) && (choices[x.key] === undefined || (includeDeclined && choices[x.key] === 'declined')))
}

/** Creates the template from a candidate (the exercises already exist: they came from your history). */
export async function addCandidateTemplate(c: TemplateCandidate, restSeconds: number, d: LiftLogDB = defaultDb): Promise<number> {
  const last = await d.routines.orderBy('order').last()
  return d.routines.add({
    name: c.name, order: (last?.order ?? -1) + 1,
    items: c.items.map((i) => ({ exerciseId: i.exerciseId, targetSets: i.sets, repRangeMin: i.repMin, repRangeMax: i.repMax, restSeconds, notes: '' })),
  })
}
