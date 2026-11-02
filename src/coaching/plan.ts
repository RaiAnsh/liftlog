import type { Routine, SkipEntry, Workout } from '../types'
import { nextInRotation, rotationOf, type Skip } from './suggest'

/** JS weekday numbers (0 = Sunday ... 6 = Saturday), listed Monday-first for display. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Turns "which days am I free?" into a week: your templates in rotation order, one per free day.
 * With more free days than templates it cycles (Push, Pull, Legs, Push...); with fewer days it uses the first few.
 * Returns an array indexed by JS weekday with a routine id or null (rest).
 */
export function buildPlan(freeDays: number[], routines: Routine[], program: number[] = []): (number | null)[] {
  const rot = rotationOf(routines, program)
  const plan: (number | null)[] = Array(7).fill(null)
  if (!rot.length) return plan
  const days = WEEK_ORDER.filter((d) => freeDays.includes(d))
  days.forEach((d, i) => { plan[d] = rot[i % rot.length].id! })
  return plan
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

export type PlanState =
  | { state: 'planned'; routine: Routine; label: string }
  | { state: 'done'; next: NextPlanned | null }
  | { state: 'skipped'; next: NextPlanned | null }
  | { state: 'rest'; next: NextPlanned | null }
export interface NextPlanned { dayIndex: number; routine: Routine; inDays: number }

/** The next planned workout after today (or today's if `includeToday`). */
export function nextPlanned(plan: (number | null)[], routines: Routine[], now: number, includeToday = false): NextPlanned | null {
  const today = new Date(now).getDay()
  for (let i = includeToday ? 0 : 1; i <= 7; i++) {
    const d = (today + i) % 7
    const r = routines.find((x) => x.id === plan[d])
    if (r) return { dayIndex: d, routine: r, inDays: i }
  }
  return null
}

/** What your plan says about today: do this workout, you've done it, you skipped it, or it's a rest day. */
export function planToday(plan: (number | null)[] | null, routines: Routine[], workouts: Workout[], skipLog: SkipEntry[], now: number): PlanState | null {
  if (!plan || !plan.some((x) => x !== null)) return null
  const today = new Date(now).getDay()
  const routine = routines.find((r) => r.id === plan[today])
  const next = nextPlanned(plan, routines, now)
  if (workouts.some((w) => sameDay(w.startedAt, now))) return { state: 'done', next }
  if (skipLog.some((s) => sameDay(s.at, now))) return { state: 'skipped', next }
  if (!routine) return { state: 'rest', next }
  return { state: 'planned', routine, label: DAY_LONG[today] }
}

/** For the "your week" strip: what was/is planned each day and what actually happened (Monday-first). */
export function weekStrip(plan: (number | null)[] | null, routines: Routine[], workouts: Workout[], skipLog: SkipEntry[], weekStart: number, now: number) {
  return WEEK_ORDER.map((d) => {
    const offset = (d + 6) % 7 // Monday = 0
    const date = new Date(weekStart); date.setDate(date.getDate() + offset)
    const t = date.getTime()
    return {
      day: d, label: DAY_SHORT[d], date: t,
      routine: routines.find((r) => r.id === plan?.[d]) ?? null,
      done: workouts.some((w) => sameDay(w.startedAt, t)),
      skipped: skipLog.some((s) => sameDay(s.at, t)),
      today: sameDay(t, now),
      past: t < new Date(now).setHours(0, 0, 0, 0),
    }
  })
}

/** Rotation suggestion used when there's no plan, re-exported so callers import planning from one place. */
export { nextInRotation }
export type { Skip }
