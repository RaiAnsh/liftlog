import { useDeferredValue, useMemo, useState } from 'react'
import { db } from '../db/db'
import { buildExercise } from '../db/exercises'
import { useSettings } from '../db/settings'
import { useExerciseItems } from '../lib/useExerciseItems'
import { MUSCLES, MUSCLE_LABELS, type Exercise, type Muscle } from '../types'
import ExerciseThumb from './ExerciseThumb'
import { SearchIcon } from './Icons'

type Filter = 'all' | 'pf' | 'mine' | Muscle

/** Full-screen chooser. Library entries you haven't used yet are added to your exercises on selection. */
export default function ExercisePicker({ multi, onPick, onClose }: { multi?: boolean; onPick: (ex: Exercise[]) => void; onClose: () => void }) {
  const { units } = useSettings()
  const items = useExerciseItems()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [chosen, setChosen] = useState<string[]>([])
  const dq = useDeferredValue(q)

  const rows = useMemo(() => {
    const t = dq.trim().toLowerCase()
    return (items ?? []).filter((i) =>
      (!t || i.name.toLowerCase().includes(t)) &&
      (filter === 'all' || (filter === 'pf' ? i.pf : filter === 'mine' ? i.mine : i.muscles.includes(filter))))
  }, [items, dq, filter])

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
  const chips: [Filter, string][] = [['all', 'All'], ['pf', 'Planet Fitness'], ['mine', 'My exercises'], ...MUSCLES.map((m): [Filter, string] => [m, MUSCLE_LABELS[m]])]

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-xl flex-col bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button className="min-h-[44px] pr-3 text-accent" onClick={onClose}>Cancel</button>
        <div className="font-bold">{multi ? 'Add exercises' : 'Choose exercise'}</div>
        <div className="w-14" />
      </div>
      <div className="space-y-3 px-4 pb-2">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><SearchIcon /></span>
          <input autoFocus={false} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises"
            className="w-full rounded-2xl bg-card py-3 pl-10 pr-4 outline-none placeholder:text-mute focus:ring-2 focus:ring-accent" />
        </div>
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          {chips.map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'chip-on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="overflow-hidden rounded-2xl bg-card">
          {rows.map((i, idx) => {
            const on = chosen.includes(i.key)
            return (
              <button key={i.key} onClick={() => toggle(i.key)}
                className={`row-press flex w-full items-center gap-3 px-3 py-2.5 text-left ${idx ? 'border-t border-line' : ''} ${on ? 'bg-accent/15' : ''}`}>
                <ExerciseThumb name={i.name} muscle={i.muscles[0]} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.name}</div>
                  <div className="truncate text-sm text-mute">{i.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || 'No muscles tagged'}</div>
                </div>
                {i.pf && <span className="rounded-md bg-[#5b2a86]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#c9a2ff]">PF</span>}
                {multi && <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-transparent bg-accent text-white' : 'border-line'}`}>{on ? '✓' : ''}</span>}
              </button>
            )
          })}
          {items && rows.length === 0 && <div className="p-4 text-mute">No exercises match.</div>}
        </div>
      </div>
      {multi && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <button className="btn btn-primary w-full disabled:opacity-40" disabled={!chosen.length} onClick={() => resolve(chosen)}>
            Add {chosen.length || ''} exercise{chosen.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  )
}
