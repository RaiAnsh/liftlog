import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import { BackBar } from '../components/PageHeader'
import ExercisePicker from '../components/ExercisePicker'
import ExerciseThumb from '../components/ExerciseThumb'
import type { RoutineItem } from '../types'

const num = (v: string, fallback: number) => (Number.isFinite(parseInt(v, 10)) ? Math.max(0, parseInt(v, 10)) : fallback)

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex-1 text-center">
      <div className="label mb-1">{label}</div>
      <input inputMode="numeric" value={value} onChange={(e) => onChange(num(e.target.value, 0))} onFocus={(e) => e.target.select()}
        className="num h-11 w-full rounded-lg bg-card2 text-center text-[17px] font-semibold outline-none focus:ring-2 focus:ring-accent" />
    </label>
  )
}

export default function RoutineEdit() {
  const { id } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const { defaultRestSeconds } = useSettings()
  const [name, setName] = useState('')
  const [items, setItems] = useState<RoutineItem[]>([])
  const [loaded, setLoaded] = useState(isNew)
  const [adding, setAdding] = useState(false)
  const exMap = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), [])

  useEffect(() => {
    if (isNew) return
    db.routines.get(Number(id)).then((r) => { if (r) { setName(r.name); setItems(r.items) } setLoaded(true) })
  }, [id, isNew])

  const patch = (i: number, p: Partial<RoutineItem>) => setItems((l) => l.map((it, k) => (k === i ? { ...it, ...p } : it)))
  const move = (i: number, dir: -1 | 1) => setItems((l) => {
    const j = i + dir
    if (j < 0 || j >= l.length) return l
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]
    return c
  })

  async function save() {
    const clean = name.trim() || 'New template'
    if (isNew) {
      const last = await db.routines.orderBy('order').last()
      await db.routines.add({ name: clean, items, order: (last?.order ?? -1) + 1 })
    } else {
      await db.routines.update(Number(id), { name: clean, items })
    }
    nav(-1)
  }

  if (!loaded || !exMap) return <p className="text-mute">Loading…</p>
  const btn = 'flex h-11 min-w-[44px] items-center justify-center rounded-xl bg-card2 px-3 text-sm font-semibold disabled:opacity-30'

  return (
    <div className="space-y-3">
      <BackBar />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" aria-label="Template name"
        className="w-full bg-transparent text-[30px] font-extrabold tracking-tight outline-none placeholder:text-mute/50" />

      {items.length === 0 && <div className="card text-center text-mute">Add exercises to build this template.</div>}
      {items.map((it, i) => {
        const e = exMap.get(it.exerciseId)
        return (
          <div key={i} className="card space-y-3">
            <div className="flex items-center gap-3">
              <ExerciseThumb name={e?.name ?? '?'} muscles={e?.primaryMuscles} secondary={e?.secondaryMuscles} size={44} />
              <div className="min-w-0 flex-1 truncate text-[17px] font-bold">{e?.name ?? 'Unknown exercise'}</div>
            </div>
            <div className="flex gap-2">
              <Field label="Sets" value={it.targetSets} onChange={(n) => patch(i, { targetSets: n })} />
              <Field label="Min reps" value={it.repRangeMin} onChange={(n) => patch(i, { repRangeMin: n })} />
              <Field label="Max reps" value={it.repRangeMax} onChange={(n) => patch(i, { repRangeMax: n })} />
              <Field label="Rest (s)" value={it.restSeconds} onChange={(n) => patch(i, { restSeconds: n })} />
            </div>
            <input value={it.notes} onChange={(ev) => patch(i, { notes: ev.target.value })} placeholder="Notes (seat height, grip…)"
              className="w-full rounded-lg bg-card2 px-3 py-2.5 outline-none placeholder:text-mute/70 focus:ring-2 focus:ring-accent" />
            <div className="flex gap-2">
              <button className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button className={btn} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button className={`${btn} ml-auto text-red-500`} onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>Remove</button>
            </div>
          </div>
        )
      })}

      <button className="btn w-full" onClick={() => setAdding(true)}>+ Add exercise</button>
      <button className="btn btn-primary w-full" onClick={save}>Save template</button>

      {adding && (
        <ExercisePicker multi onClose={() => setAdding(false)} onPick={(list) => {
          setItems((l) => [...l, ...list.map((e): RoutineItem => ({ exerciseId: e.id!, targetSets: 3, repRangeMin: e.repRangeMin, repRangeMax: e.repRangeMax, restSeconds: defaultRestSeconds, notes: '' }))])
          setAdding(false)
        }} />
      )}
    </div>
  )
}
