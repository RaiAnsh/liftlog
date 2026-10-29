import { MUSCLES, type GoalId, type Muscle, type Settings, type Tier } from '../types'

/**
 * Weekly hard sets per muscle for each tier. Research finds more weekly sets generally means more growth
 * with diminishing returns (so priority muscles get the most), and that far less volume is enough to
 * hold on to muscle you aren't pushing (so "light" is a maintenance dose). Editable per muscle.
 */
export const TIER_RANGE: Record<Tier, { min: number; max: number }> = {
  priority: { min: 14, max: 22 },
  standard: { min: 10, max: 16 },
  light: { min: 5, max: 9 },
}
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
export function targetsFor(tiers: TierMap): Settings['weeklyTargets'] {
  return Object.fromEntries(MUSCLES.map((m) => [m, { ...TIER_RANGE[tiers[m]] }])) as Settings['weeklyTargets']
}

export const goalLabel = (g: Settings['goal']) => (g ? (g.id === 'custom' ? 'Custom' : (goalPreset(g.id)?.label ?? 'Custom')) : null)

export const priorityMuscles = (g: Settings['goal']): Muscle[] => (g ? MUSCLES.filter((m) => g.tiers[m] === 'priority') : [])
export const tierOf = (g: Settings['goal'], m: Muscle): Tier | null => (g ? g.tiers[m] : null)
