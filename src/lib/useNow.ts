import { useEffect, useState } from 'react'

/** Re-renders on an interval and when the app returns to the foreground (timers are derived from timestamps). */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [intervalMs, enabled])
  return now
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
