import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { guessMuscles } from '../import/exerciseMap'
import type { ExerciseItem } from '../lib/useExerciseItems'
import ExerciseBrowser from './ExerciseBrowser'

const item = (name: string, sets = 0, o: Partial<ExerciseItem> = {}): ExerciseItem => ({ key: name.toLowerCase(), name, muscles: guessMuscles(name).primary, mine: true, pf: false, sets, ...o })
const html = (items: ExerciseItem[] | undefined) => renderToStaticMarkup(<ExerciseBrowser items={items} renderRow={(i) => <span data-row>{i.name}</span>} />)

describe('ExerciseBrowser (organised picker)', () => {
  const chest = ['Bench Press (Smith Machine)', 'Chest Press (Machine)', 'Incline Chest Press (Machine)', 'Pec Deck (Machine)', 'Cable Crossover', 'Push Up'].map((n, i) => item(n, 60 - i * 5))
  const items = [...chest, item('Lat Pulldown (Cable)', 40), item('Leg Press', 30, { pf: true }), item('Crunch (Machine)', 5)]

  it('shows the Push / Pull / Legs / Core switcher with counts', () => {
    const h = html(items)
    for (const label of ['All', 'Push', 'Pull', 'Legs', 'Core']) expect(h).toContain(`>${label}`)
    expect(h).toMatch(/Push[\s\S]*?6<\/span>/) // six chest exercises in Push
  })
  it('groups under big Push / Pull / Legs headings with muscle sections beneath', () => {
    const h = html(items)
    for (const g of ['Push', 'Pull', 'Legs', 'Core']) expect(h).toContain(`<h2 class="text-xl font-extrabold tracking-tight">${g}</h2>`)
    for (const s of ['Chest', 'Back', 'Quads', 'Abs']) expect(h).toContain(`>${s}</span>`)
  })
  it('folds long sections to the 4 most-used with a "Show 2 more" row', () => {
    const h = html(items)
    expect(h).toContain('Show 2 more')
    expect(h).toContain('Bench Press (Smith Machine)') // most used, visible
    expect(h).not.toContain('>Push Up<') // least used chest exercise is folded away
    expect(html(items.slice(0, 4).concat(items.slice(6)))).not.toContain('Show ')
  })
  it('renders each exercise through the supplied row renderer', () => {
    expect((html(items).match(/data-row/g) ?? []).length).toBe(4 + 1 + 1 + 1) // 4 chest + back + quads + abs
  })
  it('shows skeletons while loading and a helpful empty state otherwise', () => {
    expect(html(undefined)).toContain('skeleton')
    expect(html([])).toContain('Nothing here yet.')
  })
})
