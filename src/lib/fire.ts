import { useSyncExternalStore } from 'react'
import type { Fire } from '../workout/momentum'

export interface FireShow extends Fire { id: number }
let current: FireShow | null = null
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const FIRE_MS: Record<Fire['level'], number> = { 1: 2200, 2: 2600, 3: 3200 }

export function showFire(f: Fire) {
  current = { ...f, id: ++seq }
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => { current = null; emit() }, FIRE_MS[f.level])
}
export const useFire = () => useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => current)
