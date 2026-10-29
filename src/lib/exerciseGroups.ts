import type { Muscle } from '../types'
import type { ExerciseItem } from './useExerciseItems'

export type GroupId = 'push' | 'pull' | 'legs' | 'core' | 'other'
export type Scope = 'all' | 'mine' | 'library'

export interface Section { id: string; label: string; muscles: Muscle[] }
export interface Group { id: GroupId; label: string; blurb: string; color: string; sections: Section[] }

/** The classic split, with each muscle filed under the section a lifter would look for it in. */
export const GROUPS: Group[] = [
  {
    id: 'push', label: 'Push', blurb: 'Chest, shoulders, triceps', color: '#ff8a3d',
    sections: [
      { id: 'chest', label: 'Chest', muscles: ['chest'] },
      { id: 'shoulders', label: 'Shoulders', muscles: ['front_delts', 'side_delts'] },
      { id: 'triceps', label: 'Triceps', muscles: ['triceps'] },
    ],
  },
  {
    id: 'pull', label: 'Pull', blurb: 'Back, rear delts, biceps', color: '#3d9bff',
    sections: [
      { id: 'back', label: 'Back', muscles: ['upper_back_lats'] },
      { id: 'rear', label: 'Rear delts', muscles: ['rear_delts'] },
      { id: 'traps', label: 'Traps', muscles: ['traps'] },
      { id: 'biceps', label: 'Biceps', muscles: ['biceps'] },
      { id: 'forearms', label: 'Forearms', muscles: ['forearms'] },
    ],
  },
  {
    id: 'legs', label: 'Legs', blurb: 'Quads, hamstrings, glutes, calves', color: '#34c76e',
    sections: [
      { id: 'quads', label: 'Quads', muscles: ['quads'] },
      { id: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'] },
      { id: 'glutes', label: 'Glutes', muscles: ['glutes'] },
      { id: 'calves', label: 'Calves', muscles: ['calves'] },
    ],
  },
  {
    id: 'core', label: 'Core', blurb: 'Abs and lower back', color: '#b57bff',
    sections: [
      { id: 'abs', label: 'Abs', muscles: ['abs'] },
      { id: 'lowerback', label: 'Lower back', muscles: ['lower_back'] },
    ],
  },
  { id: 'other', label: 'Cardio & other', blurb: 'Exercises without a muscle tag', color: '#8a93a3', sections: [{ id: 'other', label: 'Cardio & other', muscles: [] }] },
]

/** Where an exercise lives: by its first primary muscle (a deadlift is filed under hamstrings, etc.). */
export function locate(primary: Muscle[]): { group: Group; section: Section } {
  const m = primary[0]
  if (m) for (const group of GROUPS) for (const section of group.sections) if (section.muscles.includes(m)) return { group, section }
  const other = GROUPS[GROUPS.length - 1]
  return { group: other, section: other.sections[0] }
}

export interface OrganizedSection { group: Group; section: Section; items: ExerciseItem[] }

/**
 * Filters by search text and scope (everything / mine / built-in library), then files each exercise under
 * its group and muscle section. Empty sections are dropped; within a section the most-used come first.
 */
export function organize(items: ExerciseItem[], o: { query?: string; scope?: Scope; group?: GroupId | 'all' }): OrganizedSection[] {
  const q = (o.query ?? '').trim().toLowerCase()
  const scope = o.scope ?? 'all'
  const buckets = new Map<string, OrganizedSection>()
  for (const it of items) {
    if (q && !it.name.toLowerCase().includes(q)) continue
    if (scope === 'mine' && !it.mine) continue
    if (scope === 'library' && !it.lib) continue
    const { group, section } = locate(it.muscles)
    if (o.group && o.group !== 'all' && group.id !== o.group) continue
    const key = `${group.id}/${section.id}`
    ;(buckets.get(key) ?? buckets.set(key, { group, section, items: [] }).get(key)!).items.push(it)
  }
  const order = GROUPS.flatMap((g) => g.sections.map((s) => `${g.id}/${s.id}`))
  return [...buckets.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([, v]) => ({ ...v, items: [...v.items].sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)) }))
}
