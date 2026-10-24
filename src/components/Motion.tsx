import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts up from 0 (or the previous value) to `value` with an ease-out curve. */
export function CountUp({ value, duration = 700, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(reduced() ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced()) { setShown(value); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3))
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(shown)}</>
}

/** A bar whose fill grows from empty when it appears. */
export function AnimatedBar({ pct, className = 'bg-accent', delay = 0 }: { pct: number; className?: string; delay?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setW(Math.max(0, Math.min(100, pct))), 40 + delay)
    return () => clearTimeout(id)
  }, [pct, delay])
  return <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${className}`} style={{ width: `${w}%` }} />
}

const COLORS = ['#ffb828', '#34c76e', '#0a84ff', '#ff5a46', '#c9a2ff', '#ffffff']

/** A short burst of confetti. Mount it (with a new `key`) to fire. */
export function Confetti() {
  const bits = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.5
    const r = 70 + Math.random() * 110
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 + 40, rot: Math.random() * 540 - 270, c: COLORS[i % COLORS.length], d: Math.random() * 120 }
  })
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} className="confetti-bit" style={{ background: b.c, animationDelay: `${b.d}ms`, ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg` }} />
      ))}
    </div>
  )
}

/** Fades a screen in (and up) whenever `routeKey` changes. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  return <div key={routeKey} className="page-in">{children}</div>
}
