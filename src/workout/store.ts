import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import type { ActiveWorkout } from '../types'
import { saveWorkout } from './save'
import { getSettings, setSetting } from '../db/settings'

let state: ActiveWorkout | null = null
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let pending: Promise<void> = Promise.resolve()

/** Call once before first render so a workout in progress is restored after a reload. */
export async function loadDraft() {
  try {
    state = (await db.active.get('current')) ?? null
  } catch {
    state = null
  }
}

function persistNow() {
  if (timer) clearTimeout(timer)
  timer = null
  const snapshot = state
  pending = pending.then(() => (snapshot ? db.active.put(snapshot) : db.active.delete('current')).then(() => undefined)).catch(() => undefined)
  return pending
}

function commit(next: ActiveWorkout | null) {
  state = next
  listeners.forEach((l) => l())
  if (timer) clearTimeout(timer)
  timer = setTimeout(persistNow, 120)
}

if (typeof document !== 'undefined') {
  // Backgrounding the PWA (or locking the screen) flushes immediately so nothing typed is lost.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persistNow())
  window.addEventListener('pagehide', () => void persistNow())
}

export const getDraft = () => state
export const useDraft = () => useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => state)

export const startDraft = (d: ActiveWorkout) => commit(d)
export const updateDraft = (f: (d: ActiveWorkout) => ActiveWorkout) => state && commit(f(state))

export async function discardDraft() {
  commit(null)
  await persistNow()
}

/** Saves completed sets to history and clears the draft. Returns the new workout id, or null if nothing was logged. */
export async function finishDraft(): Promise<number | null> {
  if (!state) return null
  const trained = new Set(state.exercises.filter((e) => e.sets.some((s) => s.completed)).map((e) => e.exerciseId))
  const id = await saveWorkout(state, Date.now())
  if (id) {
    // A chosen deload applies to one session; training the lift again uses it up.
    const cs = (await getSettings()).coachState
    const deload = Object.fromEntries(Object.entries(cs.deload).filter(([k]) => !trained.has(Number(k))))
    if (Object.keys(deload).length !== Object.keys(cs.deload).length) await setSetting('coachState', { ...cs, deload })
  }
  commit(null)
  await persistNow()
  return id
}
