import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { setSetting, useSettings } from '../db/settings'
import { rotationOf } from '../coaching/suggest'
import { BackBar, Title } from '../components/PageHeader'
import type { Routine } from '../types'

async function move(list: Routine[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const reordered = [...list]
  ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
  await db.transaction('rw', db.routines, async () => {
    await Promise.all(reordered.map((r, k) => db.routines.update(r.id!, { order: k })))
  })
}

export async function duplicateRoutine(r: Routine) {
  const last = await db.routines.orderBy('order').last()
  return db.routines.add({ name: `${r.name} copy`, items: r.items.map((i) => ({ ...i })), order: (last?.order ?? -1) + 1 })
}

export default function Routines() {
  const list = useLiveQuery(() => db.routines.orderBy('order').toArray())
  const { program } = useSettings()
  if (!list) return <p className="text-mute">Loading…</p>
  const inRot = new Set(rotationOf(list, program).map((r) => r.id!))
  const btn = 'flex h-11 min-w-[44px] items-center justify-center rounded-xl bg-card2 px-3 text-sm font-semibold disabled:opacity-30'
  return (
    <div className="space-y-3">
      <BackBar />
      <Title sub="Create as many as you like">Routines</Title>
      <p className="text-sm text-mute">Routines marked “In rotation” are suggested one after another, in the order below.</p>
      <Link to="/routine/new" className="btn btn-primary flex items-center justify-center">+ New routine</Link>
      {list.length === 0 && <div className="card text-mute">No routines yet.</div>}
      {list.map((r, i) => (
        <div key={r.id} className="card space-y-3">
          <div>
            <div className="text-lg font-bold">{r.name}</div>
            <div className="text-sm text-mute">{r.items.length} exercises</div>
          </div>
          <button
            className={`chip flex items-center ${inRot.has(r.id!) ? 'chip-on' : ''}`}
            onClick={() => {
              const ids = inRot.has(r.id!) ? [...inRot].filter((x) => x !== r.id) : [...inRot, r.id!]
              setSetting('program', ids.length ? ids : [])
            }}
          >{inRot.has(r.id!) ? '✓ In rotation' : 'Not in rotation'}</button>
          <div className="flex flex-wrap gap-2">
            <Link to={`/routine/${r.id}`} className={btn}>Edit</Link>
            <button className={btn} disabled={i === 0} onClick={() => move(list, i, -1)} aria-label="Move up">↑</button>
            <button className={btn} disabled={i === list.length - 1} onClick={() => move(list, i, 1)} aria-label="Move down">↓</button>
            <button className={btn} onClick={() => duplicateRoutine(r)}>Duplicate</button>
            <button className={`${btn} text-red-500`} onClick={() => confirm(`Delete “${r.name}”? Past workouts are not affected.`) && db.routines.delete(r.id!)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
