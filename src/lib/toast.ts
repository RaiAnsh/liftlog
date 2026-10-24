import { useSyncExternalStore } from 'react'

export interface Toast { id: number; text: string; sub?: string; kind: 'pr' | 'info' }
let toast: Toast | null = null
let seq = 0
let hide: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(text: string, opts: { sub?: string; kind?: Toast['kind']; ms?: number } = {}) {
  toast = { id: ++seq, text, sub: opts.sub, kind: opts.kind ?? 'info' }
  emit()
  clearTimeout(hide)
  hide = setTimeout(dismissToast, opts.ms ?? 3800)
}
export function dismissToast() { toast = null; emit() }
export const useToast = () => useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => toast)
