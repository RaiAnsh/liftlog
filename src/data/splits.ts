import { db as defaultDb, type LiftLogDB } from '../db/db'
import { normName } from './inferTemplates'
import { EXAMPLE_TEMPLATES, addExampleTemplate } from './templates'
import { WEEK_ORDER } from '../coaching/plan'
import { MUSCLES, type Settings, type Unit } from '../types'

export type SplitKind = 'vtaper' | 'glutes' | 'balanced'

export interface Split {
  /** which example template (src/data/templates.ts) trains on each training day, in week order */
  ids: string[]
  /** short name for the whole split, e.g. "Push / Pull / Legs" */
  label: string
  /** one honest sentence on why this split suits that many days */
  note: string
}

const VT: Record<number, Split> = {
  1: { ids: ['fullbody-a'], label: 'Full body', note: 'One day a week: train everything, hardest first.' },
  2: { ids: ['fullbody-a', 'fullbody-b'], label: 'Full body A / B', note: 'Two days: everything each time, so every muscle is hit twice a week.' },
  3: { ids: ['push', 'pull', 'legs'], label: 'Push / Pull / Legs', note: 'Three days: the classic split. Each muscle gets one focused session a week.' },
  4: { ids: ['chestback', 'legs', 'shoulders-arms', 'upper'], label: 'Chest & Back / Legs / Shoulders & Arms / Upper', note: 'Four days with three upper-body sessions, so chest, back and shoulders get hit about twice a week while legs stay on a lighter dose.' },
  5: { ids: ['push', 'pull', 'legs', 'shoulders-arms', 'chestback'], label: 'Push / Pull / Legs / Shoulders & Arms / Chest & Back', note: 'Five days: PPL plus a Shoulders & Arms day and a Chest & Back day, so the V-taper muscles get two sessions a week.' },
  6: { ids: ['push', 'pull', 'legs', 'push-b', 'pull-b', 'shoulders-arms'], label: 'Push / Pull / Legs, twice', note: 'Six days: push and pull twice, legs once, plus extra shoulder and arm work.' },
  7: { ids: ['push', 'pull', 'legs', 'push-b', 'pull-b', 'shoulders-arms', 'cardio-core'], label: 'Six lifting days + Cardio & Core', note: 'Seven days: six lifting days and an easy Cardio & Core day, so there is still active recovery.' },
}
const GL: Record<number, Split> = {
  1: { ids: ['fullbody-a'], label: 'Full body', note: 'One day a week: train everything, legs first.' },
  2: { ids: ['glutes-ham', 'upper'], label: 'Glutes & Hams / Upper', note: 'Two days: a glute-focused lower day and an upper day.' },
  3: { ids: ['glutes-ham', 'upper', 'quads-glutes'], label: 'Glutes & Hams / Upper / Quads & Glutes', note: 'Three days: two glute-focused lower days and one upper day.' },
  4: { ids: ['glutes-ham', 'upper', 'quads-glutes', 'glute-pump'], label: 'Glutes & Hams / Upper / Quads & Glutes / Glute Pump', note: 'Four days: glutes get trained three times a week, with one upper day to balance.' },
  5: { ids: ['glutes-ham', 'upper', 'quads-glutes', 'upper-b', 'glute-pump'], label: 'Three glute days + two upper days', note: 'Five days: glutes and legs three times, upper body twice.' },
  6: { ids: ['glutes-ham', 'upper', 'quads-glutes', 'upper-b', 'glute-pump', 'hams-calves'], label: 'Lower-focused six-day split', note: 'Six days: four lower-body days (glutes, quads, hamstrings, calves) and two upper days.' },
  7: { ids: ['glutes-ham', 'upper', 'quads-glutes', 'upper-b', 'glute-pump', 'hams-calves', 'cardio-core'], label: 'Six lifting days + Cardio & Core', note: 'Seven days: six lifting days and an easy Cardio & Core day for active recovery.' },
}
const BAL: Record<number, Split> = {
  1: VT[1], 2: VT[2], 3: VT[3],
  4: { ids: ['upper', 'lower', 'upper-b', 'lower-b'], label: 'Upper / Lower, twice', note: 'Four days: upper and lower twice each, so every muscle is hit twice a week.' },
  5: { ids: ['push', 'pull', 'legs', 'upper', 'lower'], label: 'Push / Pull / Legs + Upper / Lower', note: 'Five days: PPL plus an upper and a lower day, so most muscles are hit twice.' },
  6: { ids: ['push', 'pull', 'legs', 'push-b', 'pull-b', 'legs-b'], label: 'Push / Pull / Legs, twice', note: 'Six days: every muscle twice a week with two different versions of each day.' },
  7: { ids: ['push', 'pull', 'legs', 'push-b', 'pull-b', 'legs-b', 'cardio-core'], label: 'Push / Pull / Legs, twice + Cardio & Core', note: 'Seven days: every muscle twice, plus an easy Cardio & Core day for active recovery.' },
}

const TABLES: Record<SplitKind, Record<number, Split>> = { vtaper: VT, glutes: GL, balanced: BAL }

/** Which family of splits suits your goal. Custom goals follow whichever half of the body you prioritised. */
export function splitKindFor(goal: Settings['goal']): SplitKind {
  if (!goal) return 'balanced'
  if (goal.id === 'vtaper') return 'vtaper'
  if (goal.id === 'glutes') return 'glutes'
  if (goal.id === 'balanced') return 'balanced'
  const pri = MUSCLES.filter((m) => goal.tiers[m] === 'priority')
  const lower = pri.filter((m) => ['glutes', 'quads', 'hamstrings', 'calves'].includes(m)).length
  const upper = pri.length - lower
  return pri.length === 0 ? 'balanced' : lower > upper ? 'glutes' : upper > lower ? 'vtaper' : 'balanced'
}

/** The suggested week for N training days (1 to 7) and your focus. */
export function splitFor(days: number, kind: SplitKind): Split | null {
  const n = Math.round(days)
  return n >= 1 && n <= 7 ? TABLES[kind][n] : null
}

export const exampleById = (id: string) => EXAMPLE_TEMPLATES.find((t) => t.id === id)

/**
 * Turns a split into a week: for each training day (Monday first) finds your own template with the same name
 * or creates it from the built-in version, so your existing Push or Pull is reused rather than duplicated.
 * Returns the plan (routine id per JS weekday, null for rest) and how many templates were newly created.
 */
export async function applySplit(freeDays: number[], split: Split, unit: Unit, d: LiftLogDB = defaultDb): Promise<{ plan: (number | null)[]; created: string[] }> {
  const days = WEEK_ORDER.filter((x) => freeDays.includes(x))
  const plan: (number | null)[] = Array(7).fill(null)
  const created: string[] = []
  const cache = new Map<string, number>()
  for (let i = 0; i < days.length; i++) {
    const tpl = exampleById(split.ids[i % split.ids.length])
    if (!tpl) continue
    let id = cache.get(tpl.id)
    if (id === undefined) {
      const existing = (await d.routines.toArray()).find((r) => normName(r.name) === normName(tpl.name))
      if (existing) id = existing.id!
      else { id = await addExampleTemplate(tpl, unit, d); created.push(tpl.name) }
      cache.set(tpl.id, id)
    }
    plan[days[i]] = id
  }
  return { plan, created }
}
