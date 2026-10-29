import { targetForSet, type Target } from '../coaching/targets'
import { isCardio } from '../db/exercises'
import type {
  ActiveWorkout, DraftExercise, DraftSet, Exercise, Routine, SetType, Workout, WorkoutSet,
} from '../types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const newSet = (type: SetType = 'working'): DraftSet => ({
  uid: uid(), type, weightKg: null, reps: null, rpe: null, completed: false,
})

export function timeOfDayName(now: number): string {
  const h = new Date(now).getHours()
  return h < 12 ? 'Morning Workout' : h < 17 ? 'Afternoon Workout' : 'Evening Workout'
}

export const emptyDraft = (now: number, name?: string): ActiveWorkout => ({
  key: 'current', name: name ?? timeOfDayName(now), routineId: null, startedAt: now, notes: '', exercises: [], rest: null,
})

export function draftExercise(
  ex: Exercise, o: { restSeconds: number; sets?: number; repMin?: number | null; repMax?: number | null },
): DraftExercise {
  const cardio = isCardio(ex)
  return {
    uid: uid(), exerciseId: ex.id!, restSeconds: cardio ? 0 : o.restSeconds, notes: '', showRpe: false, superset: null,
    repMin: cardio ? null : (o.repMin ?? ex.repRangeMin), repMax: cardio ? null : (o.repMax ?? ex.repRangeMax), cardio,
    // A cardio session is usually one block; strength defaults to three sets.
    sets: Array.from({ length: o.sets ?? (cardio ? 1 : 3) }, () => newSet()),
  }
}

export function startFromRoutine(routine: Routine, exercises: Map<number, Exercise>, now: number): ActiveWorkout {
  const d = emptyDraft(now, routine.name)
  d.routineId = routine.id ?? null
  for (const it of routine.items) {
    const ex = exercises.get(it.exerciseId)
    if (!ex) continue
    const de = draftExercise(ex, { restSeconds: it.restSeconds, sets: it.targetSets, repMin: it.repRangeMin, repMax: it.repRangeMax })
    de.notes = it.notes
    d.exercises.push(de)
  }
  return d
}

/** "Start again": same exercises and number of working sets as a past workout. */
export function startFromWorkout(
  w: Workout, sets: WorkoutSet[], exercises: Map<number, Exercise>, defaultRest: number, now: number,
): ActiveWorkout {
  const d = emptyDraft(now, w.name)
  d.routineId = w.routineId
  const seen: number[] = []
  for (const s of [...sets].sort((a, b) => a.order - b.order)) if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId)
  for (const id of seen) {
    const ex = exercises.get(id)
    if (!ex) continue
    const n = sets.filter((s) => s.exerciseId === id && s.type !== 'warmup').length
    d.exercises.push(draftExercise(ex, { restSeconds: defaultRest, sets: Math.max(1, n) }))
  }
  return d
}

const cls = (t: SetType) => (t === 'warmup' ? 'w' : 'h')

/** The matching set from last time: k-th warm-up for warm-ups, k-th working-type set otherwise. */
export function previousFor(prev: WorkoutSet[] | undefined, sets: DraftSet[], index: number): WorkoutSet | null {
  if (!prev?.length) return null
  const c = cls(sets[index].type)
  const k = sets.slice(0, index + 1).filter((s) => cls(s.type) === c).length
  return prev.filter((p) => cls(p.type) === c)[k - 1] ?? null
}

const mapEx = (d: ActiveWorkout, exUid: string, f: (e: DraftExercise) => DraftExercise): ActiveWorkout => ({
  ...d, exercises: d.exercises.map((e) => (e.uid === exUid ? f(e) : e)),
})

export const updateSet = (d: ActiveWorkout, exUid: string, setUid: string, patch: Partial<DraftSet>) =>
  mapEx(d, exUid, (e) => ({ ...e, sets: e.sets.map((s) => (s.uid === setUid ? { ...s, ...patch } : s)) }))

export function addSet(d: ActiveWorkout, exUid: string): ActiveWorkout {
  return mapEx(d, exUid, (e) => {
    const last = e.sets[e.sets.length - 1]
    // New rows copy the last set's weight as a convenience, but stay uncompleted.
    return { ...e, sets: [...e.sets, { ...newSet(last && last.type !== 'warmup' ? last.type : 'working'), weightKg: last?.weightKg ?? null }] }
  })
}

export const removeSet = (d: ActiveWorkout, exUid: string, setUid: string) =>
  mapEx(d, exUid, (e) => ({ ...e, sets: e.sets.filter((s) => s.uid !== setUid) }))

/**
 * Toggle completion. Completing fills blank weight/reps from the set's target (what the row shows
 * as its placeholder), else last time's matching set, and starts the rest timer. With nothing to
 * fill reps from, it does nothing (the UI prompts for reps).
 */
export function toggleComplete(d: ActiveWorkout, exUid: string, setUid: string, prev: WorkoutSet[] | undefined, now: number, target?: Target | null): ActiveWorkout {
  const e = d.exercises.find((x) => x.uid === exUid)
  const idx = e?.sets.findIndex((s) => s.uid === setUid) ?? -1
  if (!e || idx < 0) return d
  const s = e.sets[idx]
  if (s.completed) return updateSet(d, exUid, setUid, { completed: false })

  if (e.cardio) {
    // Cardio is logged as time (and optionally distance), with no rest timer.
    const p = previousFor(prev, e.sets, idx)
    const seconds = s.seconds ?? p?.seconds ?? null
    if (!(seconds && seconds > 0)) return d
    return updateSet(d, exUid, setUid, { completed: true, seconds, distanceKm: s.distanceKm ?? (p && p.distance > 0 ? p.distance : null) })
  }

  const p = previousFor(prev, e.sets, idx)
  const t = targetForSet(target, e.sets, idx)
  const reps = s.reps ?? t?.reps ?? p?.reps ?? null
  if (reps === null) return d
  const weightKg = s.weightKg ?? t?.weightKg ?? p?.weightKg ?? null
  const next = updateSet(d, exUid, setUid, { completed: true, reps, weightKg })
  return {
    ...next,
    rest: e.restSeconds > 0 ? { endsAt: now + e.restSeconds * 1000, total: e.restSeconds, label: '', alerted: false } : next.rest,
  }
}

export function moveExercise(d: ActiveWorkout, exUid: string, dir: -1 | 1): ActiveWorkout {
  const i = d.exercises.findIndex((e) => e.uid === exUid)
  const j = i + dir
  if (i < 0 || j < 0 || j >= d.exercises.length) return d
  const list = [...d.exercises]
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...d, exercises: list }
}

/** Pair an exercise with the one after it (or detach it). */
export function toggleSuperset(d: ActiveWorkout, exUid: string): ActiveWorkout {
  const i = d.exercises.findIndex((e) => e.uid === exUid)
  if (i < 0) return d
  const cur = d.exercises[i]
  if (cur.superset !== null) {
    const group = cur.superset
    const rest = d.exercises.map((e) => (e.uid === exUid ? { ...e, superset: null } : e))
    const left = rest.filter((e) => e.superset === group)
    // A group of one is not a superset.
    return { ...d, exercises: rest.map((e) => (left.length === 1 && e.superset === group ? { ...e, superset: null } : e)) }
  }
  const next = d.exercises[i + 1]
  if (!next) return d
  const group = next.superset ?? Math.max(0, ...d.exercises.map((e) => e.superset ?? 0)) + 1
  return { ...d, exercises: d.exercises.map((e) => (e.uid === exUid || e.uid === next.uid ? { ...e, superset: group } : e)) }
}

export const swapExercise = (d: ActiveWorkout, exUid: string, ex: Exercise) =>
  mapEx(d, exUid, (e) => ({ ...e, exerciseId: ex.id!, repMin: ex.repRangeMin, repMax: ex.repRangeMax }))

export const patchExercise = (d: ActiveWorkout, exUid: string, patch: Partial<DraftExercise>) => mapEx(d, exUid, (e) => ({ ...e, ...patch }))

export const removeExercise = (d: ActiveWorkout, exUid: string): ActiveWorkout => {
  const rest = { ...d, exercises: d.exercises.filter((e) => e.uid !== exUid) }
  const counts = new Map<number, number>()
  for (const e of rest.exercises) if (e.superset !== null) counts.set(e.superset, (counts.get(e.superset) ?? 0) + 1)
  return { ...rest, exercises: rest.exercises.map((e) => (e.superset !== null && counts.get(e.superset) === 1 ? { ...e, superset: null } : e)) }
}

export function adjustRest(d: ActiveWorkout, deltaSec: number, now: number): ActiveWorkout {
  if (!d.rest) return d
  const endsAt = Math.max(now, d.rest.endsAt + deltaSec * 1000)
  return { ...d, rest: { ...d.rest, endsAt, total: Math.max(1, d.rest.total + deltaSec), alerted: endsAt > now ? false : d.rest.alerted } }
}

export const completedSetCount = (d: ActiveWorkout) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
export const incompleteSetCount = (d: ActiveWorkout) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0)

/** Convert a finished draft into rows ready for the sets table. Uncompleted sets are dropped. */
export function draftToRows(d: ActiveWorkout, now: number) {
  const workout: Omit<Workout, 'id'> = {
    routineId: d.routineId, name: d.name.trim() || 'Workout', startedAt: d.startedAt, endedAt: now, notes: d.notes.trim(), source: 'app',
  }
  const sets: Omit<WorkoutSet, 'id' | 'workoutId'>[] = []
  for (const e of d.exercises) {
    let first = true
    for (const s of e.sets) {
      if (!s.completed) continue
      sets.push({
        exerciseId: e.exerciseId, order: sets.length, type: s.type, weightKg: e.cardio ? 0 : (s.weightKg ?? 0), reps: e.cardio ? 0 : (s.reps ?? 0), rpe: s.rpe,
        distance: e.cardio ? (s.distanceKm ?? 0) : 0, seconds: e.cardio ? (s.seconds ?? 0) : 0, notes: first ? e.notes.trim() : '', completed: true, supersetGroup: e.superset,
      })
      first = false
    }
  }
  return { workout, sets }
}

/** Prepends warm-up sets (uncompleted) ahead of the exercise's existing sets. */
export function addWarmups(d: ActiveWorkout, exUid: string, warm: { weightKg: number; reps: number }[]): ActiveWorkout {
  return mapEx(d, exUid, (e) => ({
    ...e, sets: [...warm.map((w) => ({ ...newSet('warmup'), weightKg: w.weightKg, reps: w.reps })), ...e.sets],
  }))
}
