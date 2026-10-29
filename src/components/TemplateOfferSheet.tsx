import { useRef, useState } from 'react'
import { addCandidateTemplate, type TemplateCandidate } from '../data/inferTemplates'
import { getSettings, setSetting, useSettings } from '../db/settings'
import { showToast } from '../lib/toast'
import type { Exercise } from '../types'
import ExerciseThumb from './ExerciseThumb'
import Sheet from './Sheet'

/**
 * "Use “Push” as a template?" asked one workout at a time, built from the lifter's own history.
 * Every answer is remembered: a "no" (or closing the sheet) means that workout is never offered again.
 */
export default function TemplateOfferSheet({ candidates, exercises, onClose }: { candidates: TemplateCandidate[]; exercises: Map<number, Exercise>; onClose: () => void }) {
  const { defaultRestSeconds } = useSettings()
  const [i, setI] = useState(0)
  const added = useRef(0)
  const cur = candidates[i]

  const remember = async (keys: string[], choice: 'added' | 'declined') => {
    const choices = { ...(await getSettings()).templateChoices }
    for (const k of keys) choices[k] = choice
    await setSetting('templateChoices', choices)
  }
  const finish = () => {
    if (added.current) showToast(`Added ${added.current} template${added.current === 1 ? '' : 's'}`, { sub: 'Find them under My Templates.' })
    onClose()
  }
  async function answer(yes: boolean) {
    if (yes) { await addCandidateTemplate(cur, defaultRestSeconds); added.current++ }
    await remember([cur.key], yes ? 'added' : 'declined')
    if (i + 1 < candidates.length) setI(i + 1)
    else finish()
  }
  // Any way of leaving without answering counts as "no thanks" to what's left, so it never nags.
  const skipAll = async () => { await remember(candidates.slice(i).map((c) => c.key), 'declined'); finish() }

  if (!cur) return null
  return (
    <Sheet onClose={skipAll}>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-mute">
        <span>From your history</span>
        {candidates.length > 1 && <span>{i + 1} of {candidates.length}</span>}
      </div>
      <h2 className="text-2xl font-extrabold leading-tight tracking-tight">Use “{cur.name}” as a template?</h2>
      <p className="mb-3 mt-1 text-sm text-mute">
        You’ve done this workout {cur.sessions} times (last on {new Date(cur.lastAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}). This is your most recent version of it, ready to start with targets.
      </p>
      <div className="mb-4 space-y-1">
        {cur.items.map((it, k) => {
          const e = exercises.get(it.exerciseId)
          return (
            <div key={it.exerciseId} className="rise flex items-center gap-3 py-1.5" style={{ ['--i' as string]: k }}>
              <ExerciseThumb name={it.name} muscles={e?.primaryMuscles} secondary={e?.secondaryMuscles} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{it.name}</div>
                <div className="text-sm text-mute">{it.sets} set{it.sets === 1 ? '' : 's'} · {it.repMin}–{it.repMax} reps</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn press" onClick={() => answer(false)}>No thanks</button>
        <button className="btn btn-primary press" onClick={() => answer(true)}>Add template</button>
      </div>
      <p className="mt-3 text-center text-xs text-mute">
        {candidates.length - i > 1 ? <button className="font-semibold text-accent" onClick={skipAll}>No thanks to all of them</button> : 'You can change this later in Templates.'}
      </p>
    </Sheet>
  )
}
