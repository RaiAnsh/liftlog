import { MUSCLES, type GoalId, type Muscle, type Settings, type Tier, type VolumeStyle, type Workout, type WorkoutSet } from '../types'

/**
 * Weekly hard sets per muscle for each tier and volume style. Research finds more weekly sets generally means
 * more growth with diminishing returns, but low volume still works, so the style matches how you really train:
 * "efficient" suits about 2 hard sets per exercise, "standard" about 3, "high" is for maximum growth if you recover well.
 * "Light" is a maintenance dose. Every range is editable per muscle.
 */
export const STYLE_RANGE: Record<VolumeStyle, Record<Tier, { min: number; max: number }>> = {
  efficient: { priority: { min: 8, max: 14 }, standard: { min: 6, max: 10 }, light: { min: 3, max: 6 } },
  standard: { priority: { min: 14, max: 22 }, standard: { min: 10, max: 16 }, light: { min: 5, max: 9 } },
  high: { priority: { min: 16, max: 26 }, standard: { min: 12, max: 18 }, light: { min: 6, max: 10 } },
}
export const STYLE_LABEL: Record<VolumeStyle, string> = { efficient: 'Efficient', standard: 'Standard', high: 'High' }
export const STYLE_HINT: Record<VolumeStyle, string> = {
  efficient: 'About 2 hard sets per exercise. Time-friendly and still effective.',
  standard: 'About 3 hard sets per exercise. A solid, well-supported default.',
  high: 'Maximum growth if you recover well, with diminishing returns.',
}
/** The standard ranges (for callers that don't care about style). */
export const TIER_RANGE = STYLE_RANGE.standard
export const TIER_LABEL: Record<Tier, string> = { priority: 'Priority', standard: 'Standard', light: 'Maintain' }
export const TIER_HINT: Record<Tier, string> = { priority: 'Grow it most', standard: 'Steady growth', light: 'Keep what you have' }

type TierMap = Record<Muscle, Tier>
const build = (priority: Muscle[], standard: Muscle[]): TierMap =>
  Object.fromEntries(MUSCLES.map((m) => [m, priority.includes(m) ? 'priority' : standard.includes(m) ? 'standard' : 'light'])) as TierMap

export interface GoalPreset { id: GoalId; label: string; blurb: string; tiers: TierMap }

export const GOALS: GoalPreset[] = [
  {
    id: 'vtaper', label: 'Upper-body V-taper',
    blurb: 'Wide shoulders, back and chest. Legs get a lighter maintenance dose.',
    tiers: build(['chest', 'side_delts', 'upper_back_lats'], ['front_delts', 'rear_delts', 'traps', 'biceps', 'triceps', 'abs']),
  },
  {
    id: 'glutes', label: 'Glutes & legs',
    blurb: 'Build glutes, quads and hamstrings first, with some upper body to balance.',
    tiers: build(['glutes', 'quads', 'hamstrings'], ['calves', 'abs', 'upper_back_lats', 'side_delts']),
  },
  {
    id: 'balanced', label: 'Balanced all-round',
    blurb: 'Steady growth everywhere, nothing neglected.',
    tiers: build([], [...MUSCLES]),
  },
]

export const goalPreset = (id: GoalId) => GOALS.find((g) => g.id === id)

/** Turns per-muscle tiers into the weekly set ranges the whole app already uses. */
export function targetsFor(tiers: TierMap, style: VolumeStyle = 'standard'): Settings['weeklyTargets'] {
  return Object.fromEntries(MUSCLES.map((m) => [m, { ...STYLE_RANGE[style][tiers[m]] }])) as Settings['weeklyTargets']
}

/**
 * Suggests a volume style from how you actually train. If your recent workouts average about 2 working sets
 * per exercise, "efficient" targets are realistic; chasing 14-22 weekly sets from that would only be discouraging.
 * Returns null when there isn't enough history to tell.
 */
export function suggestStyle(workouts: Workout[], sets: WorkoutSet[], take = 20): VolumeStyle | null {
  const ids = new Set([...workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, take).map((w) => w.id!))
  const per = new Map<string, number>()
  for (const s of sets) {
    if (!ids.has(s.workoutId) || !s.completed || s.type === 'warmup' || s.reps <= 0) continue
    const k = `${s.workoutId}:${s.exerciseId}`
    per.set(k, (per.get(k) ?? 0) + 1)
  }
  if (per.size < 6) return null
  const avg = [...per.values()].reduce((a, b) => a + b, 0) / per.size
  return avg <= 2.5 ? 'efficient' : avg >= 4.2 ? 'high' : 'standard'
}

export const goalLabel = (g: Settings['goal']) => (g ? (g.id === 'custom' ? 'Custom' : (goalPreset(g.id)?.label ?? 'Custom')) : null)

export const priorityMuscles = (g: Settings['goal']): Muscle[] => (g ? MUSCLES.filter((m) => g.tiers[m] === 'priority') : [])
export const tierOf = (g: Settings['goal'], m: Muscle): Tier | null => (g ? g.tiers[m] : null)
