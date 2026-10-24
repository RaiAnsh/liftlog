import { useState } from 'react'
import Sheet from '../Sheet'
import { newSkip, SKIP_REASONS } from '../../coaching/skips'
import { setSetting, useSettings } from '../../db/settings'
import { showToast } from '../../lib/toast'

/**
 * "Skip 😢": confirm skipping a workout, optionally say why, and see (but never be blocked by) what it
 * would leave under target. A skip is logged, shown in History, and moves your rotation on.
 */
export default function SkipSheet({ name, routineId, warning, onStart, onClose }: {
  name: string; routineId: number | null; warning: string | null; onStart: () => void; onClose: () => void
}) {
  const { skipLog } = useSettings()
  const [reason, setReason] = useState<string | null>(null)

  async function skip() {
    await setSetting('skipLog', [...skipLog, newSkip(name, routineId, reason, Date.now())].slice(-200))
    onClose()
    showToast(`Skipped ${name} 😢`, { sub: 'Your rotation moved on. You can undo it in History.' })
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-1 text-center text-6xl wiggle" aria-hidden>😢</div>
      <h2 className="text-center text-xl font-extrabold">Skip {name}?</h2>
      {warning ? (
        <p className="mx-auto my-3 max-w-sm rounded-xl bg-warn/15 px-3 py-2.5 text-center text-sm text-warn">{warning}</p>
      ) : (
        <p className="my-3 text-center text-sm text-mute">Rest days happen. It’ll be logged as skipped.</p>
      )}
      <div className="label mb-2 text-center">Why? (optional)</div>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {SKIP_REASONS.map((r) => <button key={r} className={`chip flex items-center ${reason === r ? 'chip-on' : ''}`} onClick={() => setReason(reason === r ? null : r)}>{r}</button>)}
      </div>
      <div className="space-y-2">
        <button className="btn btn-primary w-full" onClick={() => { onClose(); onStart() }}>Do {name} instead 💪</button>
        <button className="btn w-full" onClick={skip}>Skip anyway 😢</button>
      </div>
      <p className="mt-3 text-center text-xs text-mute">Just information. It’s always your call.</p>
    </Sheet>
  )
}
