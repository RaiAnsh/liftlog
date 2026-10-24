export interface PlateResult {
  /** plates to load on each side, heaviest first */
  perSide: { plate: number; count: number }[]
  /** total bar weight actually achieved with those plates */
  achieved: number
  /** achieved - target; 0 when exactly loadable, negative when the closest lighter load is used */
  diff: number
}

const SCALE = 100 // work in hundredths so 1.25 / 2.5 lb plates stay exact

/**
 * Fewest plates per side to reach (target - bar) / 2. Exact where possible, otherwise the heaviest
 * loadable weight not exceeding the target. Uses coin-change DP because greedy fails for odd inventories
 * (e.g. 50 per side with only 45s and 25s).
 */
export function platesFor(target: number, bar: number, available: number[]): PlateResult {
  const plates = [...new Set(available)].filter((p) => p > 0).sort((a, b) => b - a)
  const side = Math.max(0, Math.round(((target - bar) / 2) * SCALE))
  if (target <= bar || !plates.length) return { perSide: [], achieved: bar, diff: bar - target }

  const ints = plates.map((p) => Math.round(p * SCALE))
  const min = new Array<number>(side + 1).fill(Infinity)
  const via = new Array<number>(side + 1).fill(-1)
  min[0] = 0
  for (let v = 1; v <= side; v++) {
    for (let i = 0; i < ints.length; i++) {
      if (ints[i] <= v && min[v - ints[i]] + 1 < min[v]) { min[v] = min[v - ints[i]] + 1; via[v] = i }
    }
  }
  let v = side
  while (v > 0 && min[v] === Infinity) v--
  const counts = new Map<number, number>()
  for (let r = v; r > 0; r -= ints[via[r]]) counts.set(plates[via[r]], (counts.get(plates[via[r]]) ?? 0) + 1)
  const perSide = plates.filter((p) => counts.has(p)).map((p) => ({ plate: p, count: counts.get(p)! }))
  const achieved = Math.round((bar + 2 * (v / SCALE)) * SCALE) / SCALE
  return { perSide, achieved, diff: Math.round((achieved - target) * SCALE) / SCALE }
}

/** Smallest increment of total weight the inventory can change by (two of the lightest plate). */
export const smallestStep = (available: number[]) => (available.length ? 2 * Math.min(...available) : 5)
