import { useState } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../db/db'
import { buildExercise } from '../db/exercises'
import { useSettings } from '../db/settings'
import { useExerciseItems } from '../lib/useExerciseItems'
import { MUSCLE_LABELS, type Exercise } from '../types'
import ExerciseThumb from './ExerciseThumb'
import ExerciseBrowser from './ExerciseBrowser'


/** Full-screen chooser. Library entries you haven't used yet are added to your exercises on selection. */
export default function ExercisePicker({ multi, onPick, onClose }: { multi?: boolean; onPick: (ex: Exercise[]) => void; onClose: () => void }) {
  const { units } = useSettings()
  const items = useExerciseItems()
  const [chosen, setChosen] = useState<string[]>([])

  async function resolve(keys: string[]) {
    const out: Exercise[] = []
    for (const k of keys) {
      const item = items!.find((i) => i.key === k)!
      let ex = await db.exercises.where('nameKey').equals(k).first()
      if (!ex) {
        const built = buildExercise(item.name, units)
        built.id = await db.exercises.add(built)
        ex = built
      }
      out.push(ex)
    }
    onPick(out)
  }

  const toggle = (k: string) => (multi ? setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k])) : resolve([k]))

  return createPortal(
    <div className="fixed inset-0 z-50 mx-auto flex max-w-xl flex-col bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button className="min-h-[44px] pr-3 text-accent" onClick={onClose}>Cancel</button>
        <div className="font-bold">{multi ? 'Add exercises' : 'Choose exercise'}</div>
        <div className="w-14 text-right text-sm font-semibold text-accent">{chosen.length > 0 ? chosen.length : ''}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <ExerciseBrowser items={items} renderRow={(i) => {
          const on = chosen.includes(i.key)
          return (
            <button onClick={() => toggle(i.key)} className={`row-press flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'bg-accent/15' : ''}`}>
              <ExerciseThumb name={i.name} muscles={i.muscles} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.name}</div>
                <div className="truncate text-sm text-mute">{i.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || 'No muscles tagged'}{i.sets ? ` · ${i.sets} sets` : ''}</div>
              </div>
              {i.pf && <span className="rounded-md bg-[#5b2a86]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#c9a2ff]">PF</span>}
              {multi && <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm transition ${on ? 'pop border-transparent bg-accent text-white' : 'border-line'}`}>{on ? '✓' : ''}</span>}
            </button>
          )
        }} />
      </div>
      {multi && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <button className="btn btn-primary w-full disabled:opacity-40" disabled={!chosen.length} onClick={() => resolve(chosen)}>
            Add {chosen.length || ''} exercise{chosen.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
