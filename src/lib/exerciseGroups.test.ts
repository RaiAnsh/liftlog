import { describe, expect, it } from 'vitest'
import { guessMuscles } from '../import/exerciseMap'
import { EXAMPLE_TEMPLATES } from '../data/templates'
import { PLANET_FITNESS_LIBRARY } from '../data/images'
import { locate, organize } from './exerciseGroups'
import type { ExerciseItem } from './useExerciseItems'

const item = (name: string, o: Partial<ExerciseItem> = {}): ExerciseItem => ({ key: name.toLowerCase(), name, muscles: guessMuscles(name).primary, mine: true, pf: false, sets: 0, ...o })

describe('filing exercises under Push / Pull / Legs / Core', () => {
  it('files by first primary muscle', () => {
    expect(locate(['chest']).group.id).toBe('push')
    expect(locate(['front_delts']).section.label).toBe('Shoulders')
    expect(locate(['side_delts']).section.label).toBe('Shoulders')
    expect(locate(['upper_back_lats']).group.id).toBe('pull')
    expect(locate(['biceps']).group.id).toBe('pull')
    expect(locate(['hamstrings', 'glutes']).section.label).toBe('Hamstrings')
    expect(locate(['abs']).group.id).toBe('core')
    expect(locate([]).group.id).toBe('other')
  })

  it('every Planet Fitness machine and example-template exercise lands in a real group', () => {
    for (const n of [...PLANET_FITNESS_LIBRARY, ...EXAMPLE_TEMPLATES.flatMap((t) => t.items.map((i) => i.name))]) {
      expect(locate(guessMuscles(n).primary).group.id, n).not.toBe('other')
    }
  })

  const items = [
    item('Bench Press (Smith Machine)', { sets: 50 }), item('Pec Deck (Machine)', { sets: 10 }), item('Lateral Raise (Dumbbell)', { sets: 30 }),
    item('Lat Pulldown (Cable)', { sets: 40 }), item('Leg Press', { sets: 20, pf: true }), item('Crunch (Machine)', { sets: 5, pf: true, mine: false }),
    item('Running (Treadmill)', { sets: 2 }),
  ]

  it('groups into ordered sections, dropping empty ones', () => {
    const r = organize(items, {})
    expect(r.map((s) => `${s.group.label}/${s.section.label}`)).toEqual(['Push/Chest', 'Push/Shoulders', 'Pull/Back', 'Legs/Quads', 'Core/Abs', 'Cardio & other/Cardio & other'])
  })
  it('puts your most-used exercises first within a section', () => {
    expect(organize(items, {})[0].items.map((i) => i.name)).toEqual(['Bench Press (Smith Machine)', 'Pec Deck (Machine)'])
  })
  it('narrows to one group', () => {
    expect(organize(items, { group: 'pull' }).flatMap((s) => s.items.map((i) => i.name))).toEqual(['Lat Pulldown (Cable)'])
    expect(organize(items, { group: 'legs' })).toHaveLength(1)
  })
  it('searches across groups, case-insensitively', () => {
    expect(organize(items, { query: ' RAISE ' }).flatMap((s) => s.items.map((i) => i.name))).toEqual(['Lateral Raise (Dumbbell)'])
    expect(organize(items, { query: 'zzz' })).toEqual([])
  })
  it('filters by scope: mine vs Planet Fitness', () => {
    expect(organize(items, { scope: 'pf' }).flatMap((s) => s.items.map((i) => i.name)).sort()).toEqual(['Crunch (Machine)', 'Leg Press'])
    const mine = organize(items, { scope: 'mine' }).flatMap((s) => s.items.map((i) => i.name))
    expect(mine).not.toContain('Crunch (Machine)')
    expect(mine).toContain('Leg Press')
  })
})
