export interface WarmupSet { weightKg: number; reps: number }

const SCHEME = [{ pct: 0.4, reps: 5 }, { pct: 0.6, reps: 3 }, { pct: 0.8, reps: 1 }]

const roundTo = (v: number, step: number) => Math.round(v / step) * step

/**
 * Ramp-up sets before the first working set: the empty bar x10 (barbell lifts only), then
 * 40% x5, 60% x3, 80% x1, rounded to what can actually be loaded. Anything that rounds onto the
 * bar, a previous set, or the working weight itself is dropped.
 */
export function warmupSets(o: { workingKg: number; barKg: number; stepKg: number; useBar: boolean }): WarmupSet[] {
  const { workingKg, barKg, stepKg, useBar } = o
  if (!(workingKg > 0)) return []
  const out: WarmupSet[] = []
  if (useBar && workingKg > barKg * 1.2) out.push({ weightKg: barKg, reps: 10 })
  for (const { pct, reps } of SCHEME) {
    const w = roundTo(workingKg * pct, stepKg)
    const last = out[out.length - 1]?.weightKg ?? 0
    if (w <= last + 1e-6 || w >= workingKg - 1e-6 || (useBar && w <= barKg + 1e-6) || w < stepKg) continue
    out.push({ weightKg: w, reps })
  }
  return out
}
