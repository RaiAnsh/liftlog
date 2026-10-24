import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sheet from '../Sheet'
import ExerciseThumb from '../ExerciseThumb'
import { skipWarning, type Suggestion } from '../../coaching/suggest'
import type { History } from '../../coaching/types'
import { setSetting } from '../../db/settings'
import { showToast } from '../../lib/toast'
import { startFromRoutine } from '../../workout/draft'
import { startDraft } from '../../workout/store'
import type { MuscleCounts } from '../../coaching/volume'
import type { Routine, Settings } from '../../types'

/** "Up next" with the reason, an optional better-fit alternative, and a non-blocking skip warning. */
export default function SuggestionCard({ s, h, counts, settings }: { s: Suggestion; h: History; counts: MuscleCounts; settings: Settings }) {
  const nav = useNavigate()
  const [warn, setWarn] = useState<string | null>(null)

  const start = (r: Routine) => { startDraft(startFromRoutine(r, h.exercises, Date.now())); nav('/workout') }

  async function skipNow(r: Routine) {
    await setSetting('lastSkip', { routineId: r.id!, at: Date.now() })
    setWarn(null)
    showToast(`Skipped ${r.name}`, { sub: 'Your rotation moved on to the next routine.' })
  }
  function trySkip(r: Routine) {
    const w = skipWarning(r, counts, settings.weeklyTargets, h.exercises)
    if (w) setWarn(w.text)
    else skipNow(r)
  }

  const thumbs = s.routine.items.slice(0, 6)
  return (
    <section className="card space-y-3">
      <div>
        <div className="label">Up next</div>
        <div className="text-2xl font-extrabold tracking-tight">{s.routine.name}</div>
        <div className="text-sm text-mute">{s.reason}</div>
      </div>
      <div className="flex -space-x-2">
        {thumbs.map((i, k) => {
          const e = h.exercises.get(i.exerciseId)
          return <div key={k} className="rounded-xl ring-2 ring-card"><ExerciseThumb name={e?.name ?? '?'} muscle={e?.primaryMuscles[0]} size={34} /></div>
        })}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-primary" onClick={() => start(s.routine)}>Start {s.routine.name}</button>
        <button className="btn px-5" onClick={() => trySkip(s.routine)}>Skip</button>
      </div>
      {s.alternative && (
        <div className="rounded-xl bg-accent/10 p-3">
          <div className="text-sm"><span className="font-semibold text-accent">Or {s.alternative.routine.name}: </span><span className="text-mute">{s.alternative.reason}.</span></div>
          <button className="mt-2 text-sm font-semibold text-accent" onClick={() => start(s.alternative!.routine)}>Start {s.alternative.routine.name} instead →</button>
        </div>
      )}
      {warn && (
        <Sheet title="Heads up" onClose={() => setWarn(null)}>
          <p className="mb-4 text-center text-lg">{warn}</p>
          <div className="space-y-2">
            <button className="btn btn-primary w-full" onClick={() => { setWarn(null); start(s.routine) }}>Do {s.routine.name} instead</button>
            <button className="btn w-full" onClick={() => skipNow(s.routine)}>Skip anyway</button>
          </div>
          <p className="mt-3 text-center text-xs text-mute">This is just information. It’s your call.</p>
        </Sheet>
      )}
    </section>
  )
}
