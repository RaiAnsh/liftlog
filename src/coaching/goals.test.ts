import { describe, expect, it } from 'vitest'
import { MUSCLES } from '../types'
import { GOALS, goalLabel, goalPreset, priorityMuscles, targetsFor, TIER_RANGE } from './goals'

describe('training goals', () => {
  it('every preset assigns a tier to every muscle', () => {
    for (const g of GOALS) for (const m of MUSCLES) expect(['priority', 'standard', 'light'], `${g.id}/${m}`).toContain(g.tiers[m])
  })
  it('V-taper prioritises chest, shoulders and back, with lighter legs', () => {
    const t = goalPreset('vtaper')!.tiers
    expect([t.chest, t.side_delts, t.upper_back_lats]).toEqual(['priority', 'priority', 'priority'])
    expect([t.quads, t.hamstrings, t.glutes, t.calves]).toEqual(['light', 'light', 'light', 'light'])
  })
  it('glutes & legs prioritises glutes, quads and hamstrings, with lighter upper body', () => {
    const t = goalPreset('glutes')!.tiers
    expect([t.glutes, t.quads, t.hamstrings]).toEqual(['priority', 'priority', 'priority'])
    expect([t.chest, t.biceps, t.triceps]).toEqual(['light', 'light', 'light'])
  })
  it('balanced has no priority muscles and every muscle on standard', () => {
    expect(priorityMuscles({ id: 'balanced', tiers: goalPreset('balanced')!.tiers })).toEqual([])
    expect(new Set(Object.values(goalPreset('balanced')!.tiers))).toEqual(new Set(['standard']))
  })
  it('turns tiers into weekly set ranges that rise with priority', () => {
    const r = targetsFor(goalPreset('vtaper')!.tiers)
    expect(r.chest).toEqual(TIER_RANGE.priority)
    expect(r.biceps).toEqual(TIER_RANGE.standard)
    expect(r.quads).toEqual(TIER_RANGE.light)
    expect(TIER_RANGE.priority.min).toBeGreaterThan(TIER_RANGE.standard.min)
    expect(TIER_RANGE.standard.min).toBeGreaterThan(TIER_RANGE.light.min)
    for (const t of Object.values(TIER_RANGE)) expect(t.max).toBeGreaterThan(t.min)
  })
  it('labels the goal', () => {
    expect(goalLabel(null)).toBeNull()
    expect(goalLabel({ id: 'vtaper', tiers: goalPreset('vtaper')!.tiers })).toBe('Upper-body V-taper')
    expect(goalLabel({ id: 'custom', tiers: goalPreset('balanced')!.tiers })).toBe('Custom')
  })
})
