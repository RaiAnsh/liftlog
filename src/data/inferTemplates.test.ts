import 'fake-indexeddb/auto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LiftLogDB } from '../db/db'
import { buildExercise } from '../db/exercises'
import { importStrongCsv } from '../import/importer'
import type { Exercise, Workout, WorkoutSet } from '../types'
import { addCandidateTemplate, inferTemplates, normName, pendingOffers } from './inferTemplates'

const DAY = 86_400_000
const now = new Date(2026, 9, 29).getTime()
const ex = (id: number, name: string): Exercise => ({ ...buildExercise(name, 'lb'), id })
const exMap = new Map([ex(1, 'Bench Press (Barbell)'), ex(2, 'Lat Pulldown (Cable)'), ex(3, 'Bicep Curl (Dumbbell)'), ex(4, 'Leg Press')].map((e) => [e.id!, e]))

let wid = 0, ord = 0
const wk = (name: string, daysAgo: number): Workout => ({ id: ++wid, routineId: null, name, startedAt: now - daysAgo * DAY, endedAt: null, notes: '', source: 'app' })
const set = (w: Workout, exerciseId: number, reps = 10, p: Partial<WorkoutSet> = {}): WorkoutSet => ({ workoutId: w.id!, exerciseId, order: ord++, type: 'working', weightKg: 50, reps, rpe: null, distance: 0, seconds: 0, notes: '', completed: true, ...p })
const build = (specs: [string, number, [number, number][]][]) => {
  const workouts: Workout[] = [], sets: WorkoutSet[] = []
  for (const [name, daysAgo, items] of specs) {
    const w = wk(name, daysAgo); workouts.push(w)
    for (const [exId, n] of items) for (let i = 0; i < n; i++) sets.push(set(w, exId))
  }
  return { workouts, sets, exercises: exMap }
}

describe('inferTemplates (from any lifter\'s history)', () => {
  const push: [number, number][] = [[1, 3], [3, 2]]
  it('turns a repeated workout name into a template from the most recent session, in order, with its set counts', () => {
    const h = build([['Push', 30, [[1, 2]]], ['Push', 20, [[1, 3]]], ['Push', 10, [[3, 2], [1, 4]]], ['Push', 2, [[2, 3], [1, 5], [3, 1]]]])
    const [c] = inferTemplates(h, { now })
    expect(c).toMatchObject({ name: 'Push', sessions: 4 })
    expect(c.items.map((i) => [i.name, i.sets])).toEqual([['Lat Pulldown (Cable)', 3], ['Bench Press (Barbell)', 5], ['Bicep Curl (Dumbbell)', 1]])
  })
  it('merges case and spacing variants and names it the way the lifter wrote it', () => {
    const h = build([['push', 5, push], ['Push', 12, push], ['push ', 20, push], ['PUSH', 30, push]])
    expect(inferTemplates(h, { now })).toHaveLength(1)
    expect(inferTemplates(h, { now })[0].sessions).toBe(4)
    expect(inferTemplates(build([['upper a', 5, push], ['upper a', 9, push], ['upper a', 12, push]]), { now })[0].name).toBe('Upper A')
    expect(inferTemplates(build([['Upper A', 5, push], ['Upper A', 9, push], ['Upper A', 12, push]]), { now })[0].name).toBe('Upper A')
  })
  it('ignores default workout names, one-offs and workouts not done in a year', () => {
    const h = build([
      ['Afternoon Workout', 3, push], ['Afternoon Workout', 6, push], ['Afternoon Workout', 9, push], ['Evening Workout', 2, push], ['Workout', 1, push], ['New Workout', 1, push],
      ['One Off', 4, push], ['Old Split', 400, push], ['Old Split', 410, push], ['Old Split', 420, push],
    ])
    expect(inferTemplates(h, { now })).toEqual([])
    expect(inferTemplates(h, { now, maxAgeDays: 100_000 }).map((c) => c.name)).toEqual(['Old Split'])
  })
  it('needs at least three sessions by default', () => {
    expect(inferTemplates(build([['Pull', 3, push], ['Pull', 8, push]]), { now })).toEqual([])
    expect(inferTemplates(build([['Pull', 3, push], ['Pull', 8, push]]), { now, minSessions: 2 })).toHaveLength(1)
  })
  it('excludes warm-ups and unfinished sets from set counts, and drops exercises with no real sets', () => {
    const w = [wk('Legs', 1), wk('Legs', 5), wk('Legs', 9)]
    const sets = [...w.flatMap((x) => [set(x, 4), set(x, 4), set(x, 4, 10, { type: 'warmup' }), set(x, 2, 10, { completed: false })])]
    const c = inferTemplates({ workouts: w, sets, exercises: exMap }, { now })[0]
    expect(c.items).toEqual([expect.objectContaining({ name: 'Leg Press', sets: 2 })])
  })
  it('suggests a rep range around what the lifter actually does', () => {
    const mk = (reps: number) => { const w = [wk('A', 1), wk('A', 3), wk('A', 5)]; return { workouts: w, sets: w.flatMap((x) => [set(x, 1, reps), set(x, 1, reps)]), exercises: exMap } }
    expect(inferTemplates(mk(10), { now })[0].items[0]).toMatchObject({ repMin: 8, repMax: 12 })
    expect(inferTemplates(mk(15), { now })[0].items[0]).toMatchObject({ repMin: 13, repMax: 18 })
    expect(inferTemplates(mk(5), { now })[0].items[0]).toMatchObject({ repMin: 3, repMax: 8 })
  })
  it('sorts by how often you do it, then how recently, and respects a limit', () => {
    const h = build([['Rare', 1, push], ['Rare', 2, push], ['Rare', 3, push], ['Often', 5, push], ['Often', 6, push], ['Often', 7, push], ['Often', 8, push]])
    expect(inferTemplates(h, { now }).map((c) => c.name)).toEqual(['Often', 'Rare'])
    expect(inferTemplates(h, { now, limit: 1 })).toHaveLength(1)
  })
})

describe('pendingOffers (asked once, "no" is remembered)', () => {
  const h = build([['Push', 1, [[1, 3]]], ['Push', 4, [[1, 3]]], ['Push', 8, [[1, 3]]], ['Pull', 2, [[2, 3]]], ['Pull', 5, [[2, 3]]], ['Pull', 9, [[2, 3]]]])
  const all = inferTemplates(h, { now })
  it('offers everything on a first visit', () => expect(pendingOffers(all, [], {}).map((c) => c.name).sort()).toEqual(['Pull', 'Push']))
  it('never offers a workout you declined or already added', () => {
    expect(pendingOffers(all, [], { [normName('Push')]: 'declined' }).map((c) => c.name)).toEqual(['Pull'])
    expect(pendingOffers(all, [], { push: 'added', pull: 'declined' })).toEqual([])
  })
  it('never offers one you already have a template for, even spelled differently', () => {
    expect(pendingOffers(all, [{ id: 1, name: ' PUSH ', order: 0, items: [] }], {}).map((c) => c.name)).toEqual(['Pull'])
  })
  it('can deliberately bring declined ones back (the manual "find templates" button)', () => {
    expect(pendingOffers(all, [], { push: 'declined', pull: 'added' }, true).map((c) => c.name)).toEqual(['Push'])
  })
})

describe('addCandidateTemplate', () => {
  it('creates a real template with the right exercises, sets and rep ranges', async () => {
    const db = new LiftLogDB('tplinf-1')
    const exs = [...exMap.values()]; for (const e of exs) await db.exercises.add(e)
    const h = build([['Push', 1, [[1, 3], [3, 2]]], ['Push', 4, [[1, 3]]], ['Push', 8, [[1, 3]]]])
    const id = await addCandidateTemplate(inferTemplates(h, { now })[0], 90, db)
    const r = (await db.routines.get(id))!
    expect(r.name).toBe('Push')
    expect(r.items.map((i) => [i.exerciseId, i.targetSets, i.restSeconds])).toEqual([[1, 3, 90], [3, 2, 90]])
    expect((await db.routines.get(await addCandidateTemplate(inferTemplates(h, { now })[0], 90, db)))!.order).toBe(1)
  })
})

// Runs only on a machine that has the private export (sample-data/ is gitignored).
const real = new URL('../../sample-data/strong_workouts.csv', import.meta.url)
describe.skipIf(!existsSync(real))('real Strong export', () => {
  it('finds the lifter\'s usual workouts and skips default names', async () => {
    const db = new LiftLogDB('tplinf-real')
    await importStrongCsv(readFileSync(real, 'utf8'), 'lb', db)
    const [workouts, sets, exercises] = await Promise.all([db.workouts.toArray(), db.sets.toArray(), db.exercises.toArray()])
    const found = inferTemplates({ workouts, sets, exercises: new Map(exercises.map((e) => [e.id!, e])) }, { now })
    const names = found.map((c) => c.name)
    expect(names).toContain('Push')
    expect(names).toContain('Pull')
    expect(names.join('|')).not.toMatch(/afternoon|evening|midday/i)
    for (const c of found) { expect(c.items.length).toBeGreaterThan(0); expect(c.sessions).toBeGreaterThanOrEqual(3) }
    console.log(found.map((c) => `${c.name} x${c.sessions}: ${c.items.map((i) => `${i.name.replace(/ \(.*\)/, '')} ${i.sets}x${i.repMin}-${i.repMax}`).join(', ')}`))
  })
})

describe('top of rep range (default 12, adjustable)', () => {
  const mk = (reps: number) => { const w = [wk('A', 1), wk('A', 3), wk('A', 5)]; return { workouts: w, sets: w.flatMap((x) => [set(x, 1, reps), set(x, 1, reps)]), exercises: exMap } }
  it('never builds a range that tops out above the lifter\'s ceiling for someone who trains up to 12', () => {
    for (const r of [8, 10, 11, 12]) expect(inferTemplates(mk(r), { now })[0].items[0].repMax, `typical ${r}`).toBe(12)
    expect(inferTemplates(mk(13), { now })[0].items[0].repMax).toBe(12) // 13 is "about 12": still the lifter's 8-12 style
  })
  it('honours a different ceiling', () => {
    expect(inferTemplates(mk(9), { now, repCeiling: 10 })[0].items[0]).toMatchObject({ repMin: 6, repMax: 10 })
    expect(inferTemplates(mk(14), { now, repCeiling: 15 })[0].items[0]).toMatchObject({ repMin: 10, repMax: 15 })
  })
  it('still builds a high-rep range for someone who really trains 18+', () => {
    expect(inferTemplates(mk(18), { now })[0].items[0].repMax).toBeGreaterThan(12)
  })
})
