import { createPortal } from 'react-dom'
import { FIRE_MS, useFire } from '../lib/fire'
import { Confetti } from './Motion'

/**
 * Full-screen "you're on fire" moment. Doesn't block taps (pointer-events: none), so you can keep logging
 * through it. Bigger streaks get a bigger flame, more embers and a screen shake.
 */
export default function FireHost() {
  const f = useFire()
  if (!f) return null
  const embers = f.level === 1 ? 10 : f.level === 2 ? 18 : 30
  const size = f.level === 1 ? 'text-[9rem]' : f.level === 2 ? 'text-[11rem]' : 'text-[13rem]'
  return createPortal(
    <div key={f.id} className={`fire-overlay pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center ${f.level === 3 ? 'fire-shake' : ''}`}
      style={{ ['--dur' as string]: `${FIRE_MS[f.level] / 1000}s` }} role="status" aria-live="polite">
      <div className="fire-glow absolute inset-0" />
      {f.title === 'NEW PR!' && <div className="absolute inset-x-0 top-1/3"><Confetti /></div>}
      {Array.from({ length: embers }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280 / 233280
        return (
          <span key={i} className="fire-ember text-2xl" aria-hidden
            style={{ left: `${10 + seed * 80}%`, ['--ex' as string]: `${(seed - 0.5) * 120}px`, ['--er' as string]: `${(seed - 0.5) * 120}deg`, ['--ed' as string]: `${1.3 + seed * 1.1}s`, ['--edelay' as string]: `${(i % 6) * 0.11}s` }}>
            {i % 4 === 0 ? '✨' : '🔥'}
          </span>
        )
      })}
      <div className={`fire-big ${size} leading-none`} aria-hidden>🔥</div>
      {f.level >= 2 && <div className="absolute flex w-full justify-between px-4 text-7xl opacity-90" aria-hidden><span className="fire-big">🔥</span><span className="fire-big">🔥</span></div>}
      <div className="fire-title mt-2 px-4 text-center text-[2.6rem] font-black leading-none tracking-tight">{f.title}</div>
      <div className="mt-2 rounded-full bg-black/55 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">{f.sub}</div>
    </div>,
    document.body,
  )
}
