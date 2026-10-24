import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import { guessMuscles } from '../import/exerciseMap'
import { addExampleTemplate, EXAMPLE_TEMPLATES } from './templates'

let n = 0
const freshDb = () => new LiftLogDB(`tpl-${n++}`)

describe('example templates', () => {
  it('includes Push, Pull, Legs and Shoulders', () => {
    const names = EXAMPLE_TEMPLATES.map((t) => t.name)
    for (const want of ['Push', 'Pull', 'Legs', 'Shoulders']) expect(names).toContain(want)
  })
  it('every exercise is recognised, so coaching has muscles for it', () => {
    for (const t of EXAMPLE_TEMPLATES) for (const it of t.items) expect(guessMuscles(it.name).known, `${t.name}: ${it.name}`).toBe(true)
  })
  it('train the muscles their names promise', () => {
    const primary = (id: string) => new Set(EXAMPLE_TEMPLATES.find((t) => t.id === id)!.items.flatMap((i) => guessMuscles(i.name).primary))
    expect(primary('push')).toEqual(new Set(['chest', 'front_delts', 'side_delts', 'triceps']))
    expect([...primary('pull')]).toEqual(expect.arrayContaining(['upper_back_lats', 'biceps', 'rear_delts']))
    expect([...primary('legs')]).toEqual(expect.arrayContaining(['quads', 'hamstrings', 'calves']))
    expect([...primary('shoulders')]).toEqual(expect.arrayContaining(['side_delts', 'rear_delts', 'traps']))
  })
  it('creates a template, adds missing exercises and reuses ones you already have', async () => {
    const db = freshDb()
    const mine = buildExercise('Chest Press (Machine)', 'lb')
    mine.id = await db.exercises.add(mine)
    const push = EXAMPLE_TEMPLATES.find((t) => t.id === 'push')!
    const rid = await addExampleTemplate(push, 'lb', db)
    const r = (await db.routines.get(rid))!
    expect(r.name).toBe('Push')
    expect(r.items).toHaveLength(push.items.length)
    expect(r.items[0].exerciseId).toBe(mine.id)
    expect(await db.exercises.count()).toBe(push.items.length)
  })
  it('appends after existing templates', async () => {
    const db = freshDb()
    await addExampleTemplate(EXAMPLE_TEMPLATES[0], 'lb', db)
    const id2 = await addExampleTemplate(EXAMPLE_TEMPLATES[1], 'lb', db)
    expect((await db.routines.get(id2))!.order).toBe(1)
  })
})
