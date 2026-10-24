import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fmtClock, useNow } from '../lib/useNow'
import { adjustRest } from '../workout/draft'
import { updateDraft, useDraft } from '../workout/store'

/** How long the "rest over" state stays visible before clearing itself. */
const DONE_VISIBLE_MS = 12_000
export const BAR_BOTTOM = 'calc(58px + env(safe-area-inset-bottom))'

/**
 * Floats above the tab bar on every screen: the rest countdown, and a way back to a workout in progress.
 * The countdown is derived from `endsAt`, so locking the screen or reloading never drifts it.
 */
export default function ActiveBar() {
  const draft = useDraft()
  const { pathname } = useLocation()
  const now = useNow(250, !!draft)
  const rest = draft?.rest ?? null

  useEffect(() => {
    if (!rest) return
    if (now >= rest.endsAt && !rest.alerted) {
      updateDraft((d) => (d.rest ? { ...d, rest: { ...d.rest, alerted: true } } : d))
      navigator.vibrate?.([300, 120, 300, 120, 500])
    } else if (now >= rest.endsAt + DONE_VISIBLE_MS) {
      updateDraft((d) => ({ ...d, rest: null }))
    }
  }, [now, rest])

  if (!draft) return null
  const left = rest ? rest.endsAt - now : 0
  const done = !!rest && left <= 0
  const onWorkout = pathname === '/workout'

  return (
    <div className="fixed inset-x-0 z-30 mx-auto max-w-xl space-y-2 px-3" style={{ bottom: `calc(${BAR_BOTTOM} + 8px)` }}>
      {rest && (
        <div className={`overflow-hidden rounded-2xl shadow-lg shadow-black/40 ${done ? 'animate-pulse bg-good text-white' : 'bg-card2'}`} role="timer" aria-live="off">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <button className="btn !min-h-[44px] !px-3 !text-[15px]" onClick={() => updateDraft((d) => adjustRest(d, -15, Date.now()))}>−15</button>
            <div className="flex-1 text-center">
              <div className="num text-[26px] font-extrabold leading-none">{done ? 'Go!' : fmtClock(Math.ceil(left / 1000) * 1000)}</div>
              <div className={`text-[11px] font-semibold uppercase tracking-wider ${done ? 'text-white/90' : 'text-mute'}`}>{done ? 'Rest over' : 'Rest'}</div>
            </div>
            <button className="btn !min-h-[44px] !px-3 !text-[15px]" onClick={() => updateDraft((d) => adjustRest(d, 15, Date.now()))}>+15</button>
            <button className="btn !min-h-[44px] !px-3 !text-[15px]" onClick={() => updateDraft((d) => ({ ...d, rest: null }))}>{done ? 'Dismiss' : 'Skip'}</button>
          </div>
          {!done && <div className="h-1 bg-line"><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.min(100, (left / (rest.total * 1000)) * 100)}%` }} /></div>}
        </div>
      )}
      {!onWorkout && (
        <Link to="/workout" className="flex items-center justify-between rounded-2xl bg-accent px-4 py-3 text-white shadow-lg shadow-black/40">
          <span className="min-w-0 truncate font-semibold">{draft.name}</span>
          <span className="num ml-3 shrink-0 text-sm font-semibold">⏱ {fmtClock(now - draft.startedAt)} · Resume ›</span>
        </Link>
      )}
    </div>
  )
}
