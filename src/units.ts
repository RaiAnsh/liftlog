import type { Unit } from './types'

const LB_PER_KG = 2.2046226218

export const toKg = (v: number, unit: Unit) => (unit === 'kg' ? v : v / LB_PER_KG)
export const fromKg = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg * LB_PER_KG)

/** Display value rounded to 2 decimals, trailing zeros stripped (45 lb survives a kg round trip). */
export function formatWeight(kg: number, unit: Unit): string {
  const v = Math.round(fromKg(kg, unit) * 100) / 100
  return String(v)
}

/** For estimates (e.g. 1RM) where two decimals are false precision. */
export function formatEstimate(kg: number, unit: Unit): string {
  return String(Math.round(fromKg(kg, unit) * 10) / 10)
}
