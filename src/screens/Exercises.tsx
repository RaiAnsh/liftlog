import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useExerciseItems } from '../lib/useExerciseItems'
import { Title } from '../components/PageHeader'
import { ChevronRight, SearchIcon } from '../components/Icons'
import ExerciseThumb from '../components/ExerciseThumb'
import { MUSCLES, MUSCLE_LABELS, type Muscle } from '../types'

type Filter = 'all' | 'pf' | 'mine' | Muscle

export default function Exercises() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const dq = useDeferredValue(q)

  const items = useExerciseItems()

  const rows = useMemo(() => {
    const t = dq.trim().toLowerCase()
    return (items ?? []).filter((i) =>
      (!t || i.name.toLowerCase().includes(t)) &&
      (filter === 'all' || (filter === 'pf' ? i.pf : filter === 'mine' ? i.mine : i.muscles.includes(filter))),
    )
  }, [items, dq, filter])

  const chips: [Filter, string][] = [['all', 'All'], ['pf', 'Planet Fitness'], ['mine', 'My exercises'], ...MUSCLES.map((m): [Filter, string] => [m, MUSCLE_LABELS[m]])]

  return (
    <div className="space-y-3">
      <Title sub="Includes Planet Fitness machines">Exercises</Title>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><SearchIcon /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises"
          className="w-full rounded-2xl bg-card py-3 pl-10 pr-4 outline-none placeholder:text-mute focus:ring-2 focus:ring-accent" />
      </div>
      <div className="scroll-x -mx-4 flex gap-2 px-4">
        {chips.map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'chip-on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        {rows.map((i, idx) => (
          <Link key={i.key} to={`/exercise/${encodeURIComponent(i.key)}`}
            className={`row-press flex items-center gap-3 px-3 py-2.5 ${idx ? 'border-t border-line' : ''}`}>
            <ExerciseThumb name={i.name} muscles={i.muscles} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{i.name}</div>
              <div className="truncate text-sm text-mute">
                {i.muscles.length ? i.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') : 'No muscles tagged'}
                {i.mine ? ` · ${i.sets} sets logged` : ' · not added yet'}
              </div>
            </div>
            {i.pf && <span className="rounded-md bg-[#5b2a86]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#c9a2ff]">PF</span>}
            <span className="text-mute"><ChevronRight /></span>
          </Link>
        ))}
        {items && rows.length === 0 && <div className="p-4 text-mute">No exercises match.</div>}
      </div>
    </div>
  )
}
