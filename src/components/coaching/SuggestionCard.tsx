import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExerciseThumb from '../ExerciseThumb'
import SkipSheet from './SkipSheet'
import { skipWarning, type Suggestion } from '../../coaching/suggest'
import type { History } from '../../coaching/types'
import type { MuscleCounts } from '../../coaching/volume'
import { startFromRoutine } from '../../workout/draft'
import { startDraft } from '../../workout/store'
import type { Routine, Settings } from '../../types'

/** "Up next" with the reason, a better-fit alternative when it's clearly worth it, and Skip 😢. */
export default function SuggestionCard({ s, h, counts, settings }: { s: Suggestion; h: History; counts: MuscleCounts; settings: Settings }) {
  const nav = useNavigate()
  const [skipping, setSkipping] = useState<Routine | null>(null)
  const start = (r: Routine) => { startDraft(startFromRoutine(r, h.exercises, Date.now())); nav('/workout') }

  return (
    <section className="rise card glow relative space-y-3 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Up next</div>
          <div className="truncate text-[26px] font-extrabold leading-tight tracking-tight">{s.routine.name}</div>
          <div className="text-sm text-mute">{s.reason}</div>
        </div>
        <div className="flex -space-x-2">
          {s.routine.items.slice(0, 3).map((i, k) => {
            const e = h.exercises.get(i.exerciseId)
            return <div key={k} className="rounded-xl ring-2 ring-card"><ExerciseThumb name={e?.name ?? '?'} muscles={e?.primaryMuscles} secondary={e?.secondaryMuscles} size={38} /></div>
          })}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-primary press" onClick={() => start(s.routine)}>Start {s.routine.name}</button>
        <button className="btn press px-5" onClick={() => setSkipping(s.routine)}>Skip 😢</button>
      </div>
      {s.alternative && (
        <div className="rounded-xl bg-accent/10 p-3">
          <div className="text-sm"><span className="font-semibold text-accent">Or {s.alternative.routine.name}: </span><span className="text-mute">{s.alternative.reason}.</span></div>
          <button className="mt-2 text-sm font-semibold text-accent" onClick={() => start(s.alternative!.routine)}>Start {s.alternative.routine.name} instead →</button>
        </div>
      )}
      {skipping && (
        <SkipSheet name={skipping.name} routineId={skipping.id!} onClose={() => setSkipping(null)} onStart={() => start(skipping)}
          warning={skipWarning(skipping, counts, settings.weeklyTargets, h.exercises)?.text ?? null} />
      )}
    </section>
  )
}
