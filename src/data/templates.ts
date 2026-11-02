import { db as defaultDb, type LiftLogDB } from '../db/db'
import { buildExercise, nameKey } from '../db/exercises'
import type { Exercise, Routine, Unit } from '../types'
import { SPLIT_TEMPLATES } from './splitTemplates'

export interface TemplateItem { name: string; sets: number; repMin: number; repMax: number; rest: number }
export interface ExampleTemplate { id: string; name: string; blurb: string; items: TemplateItem[]
  /** used by weekly split suggestions but not listed under Example templates */
  hidden?: boolean }

const t = (name: string, sets = 3, repMin = 8, repMax = 12, rest = 90): TemplateItem => ({ name, sets, repMin, repMax, rest })

/**
 * Starter templates built from what a typical commercial gym has (machines, cables, Smith machine, dumbbells).
 * They're ordinary templates once added: rename, reorder or swap anything.
 */
const BASE_TEMPLATES: ExampleTemplate[] = [
  {
    id: 'push', name: 'Push', blurb: 'Chest, shoulders, triceps',
    items: [t('Chest Press (Machine)', 3, 8, 12, 120), t('Incline Chest Press (Machine)'), t('Shoulder Press (Machine)'), t('Lateral Raise (Dumbbell)', 3, 10, 15, 60), t('Triceps Pushdown (Cable - Straight Bar)', 3, 10, 15, 60), t('Triceps Extension (Machine)', 3, 10, 15, 60)],
  },
  {
    id: 'pull', name: 'Pull', blurb: 'Back, rear delts, biceps',
    items: [t('Lat Pulldown (Cable)', 3, 8, 12, 120), t('Seated Row (Cable)'), t('Bent Over Row (Smith)'), t('Reverse Fly (Machine)', 3, 12, 15, 60), t('Bicep Curl (Dumbbell)', 3, 10, 15, 60), t('Hammer Curl (Dumbbell)', 3, 10, 15, 60)],
  },
  {
    id: 'legs', name: 'Legs', blurb: 'Quads, hamstrings, glutes, calves',
    items: [t('Squat (Smith Machine)', 3, 6, 10, 150), t('Leg Press', 3, 8, 12, 120), t('Seated Leg Curl (Machine)', 3, 10, 15, 90), t('Leg Extension (Machine)', 3, 10, 15, 90), t('Hip Abductor (Machine)', 3, 12, 15, 60), t('Standing Calf Raise (Machine)', 4, 10, 15, 60)],
  },
  {
    id: 'shoulders', name: 'Shoulders', blurb: 'Front, side and rear delts, traps',
    items: [t('Shoulder Press (Machine)', 3, 8, 12, 120), t('Lateral Raise (Dumbbell)', 4, 10, 15, 60), t('Lateral Raise (Cable)', 3, 12, 15, 60), t('Reverse Fly (Machine)', 3, 12, 15, 60), t('Face Pull (Cable)', 3, 12, 15, 60), t('Shrug (Dumbbell)', 3, 10, 15, 60)],
  },
  {
    id: 'upper', name: 'Upper Body', blurb: 'Chest, back, shoulders, arms',
    items: [t('Chest Press (Machine)'), t('Lat Pulldown (Cable)'), t('Shoulder Press (Machine)'), t('Seated Row (Cable)'), t('Lateral Raise (Dumbbell)', 3, 10, 15, 60), t('Bicep Curl (Dumbbell)', 2, 10, 15, 60), t('Triceps Pushdown (Cable - Straight Bar)', 2, 10, 15, 60)],
  },
  {
    id: 'lower', name: 'Lower Body', blurb: 'Quads, hamstrings, glutes, calves',
    items: [t('Leg Press', 3, 8, 12, 120), t('Seated Leg Curl (Machine)'), t('Leg Extension (Machine)'), t('Hip Thrust (Barbell)', 3, 8, 12, 120), t('Seated Calf Raise (Machine)', 4, 10, 15, 60)],
  },
  {
    id: 'arms', name: 'Arms', blurb: 'Biceps, triceps, forearms',
    items: [t('Bicep Curl (Machine)', 3, 8, 12, 75), t('Triceps Extension (Machine)', 3, 8, 12, 75), t('Hammer Curl (Dumbbell)', 3, 10, 15, 60), t('Triceps Pushdown (Cable - Straight Bar)', 3, 10, 15, 60), t('Forearm Curl (Dumbbell)', 3, 12, 20, 45)],
  },
]

export const EXAMPLE_TEMPLATES: ExampleTemplate[] = [...BASE_TEMPLATES, ...SPLIT_TEMPLATES]

/**
 * Creates a real template (routine) from an example, adding any exercises you don't have yet.
 * Existing exercises are reused by name, so your history and tags stay intact.
 */
export async function addExampleTemplate(tpl: ExampleTemplate, unit: Unit, d: LiftLogDB = defaultDb): Promise<number> {
  return d.transaction('rw', d.exercises, d.routines, async () => {
    const items: Routine['items'] = []
    for (const it of tpl.items) {
      let ex: Exercise | undefined = await d.exercises.where('nameKey').equals(nameKey(it.name)).first()
      if (!ex) {
        ex = buildExercise(it.name, unit)
        ex.id = await d.exercises.add(ex)
      }
      items.push({ exerciseId: ex.id!, targetSets: it.sets, repRangeMin: it.repMin, repRangeMax: it.repMax, restSeconds: it.rest, notes: '' })
    }
    const last = await d.routines.orderBy('order').last()
    return d.routines.add({ name: tpl.name, items, order: (last?.order ?? -1) + 1 })
  })
}
