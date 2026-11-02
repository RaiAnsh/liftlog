import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { setSetting, useSettings } from '../db/settings'
import { rotationOf } from '../coaching/suggest'
import { useState } from 'react'
import TemplateOfferSheet from '../components/TemplateOfferSheet'
import { inferTemplates, pendingOffers, type TemplateCandidate } from '../data/inferTemplates'
import { useHistory } from '../coaching/useCoaching'
import { showToast } from '../lib/toast'
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
  const { program, templateChoices, repCeiling } = useSettings()
  const h = useHistory()
  const [offer, setOffer] = useState<TemplateCandidate[] | null>(null)
  // Deliberate request: include older workouts and ones you said no to earlier.
  const findInHistory = () => {
    if (!h) return
    const found = pendingOffers(inferTemplates(h, { now: Date.now(), minSessions: 2, maxAgeDays: 100_000, repCeiling }), h.routines, templateChoices, true)
    if (found.length) setOffer(found)
    else showToast('Nothing new to suggest', { sub: 'Every workout you repeat already has a template.' })
  }
  if (!list) return <p className="text-mute">Loading…</p>
  const inRot = new Set(rotationOf(list, program).map((r) => r.id!))
  const btn = 'flex h-11 min-w-[44px] items-center justify-center rounded-xl bg-card2 px-3 text-sm font-semibold disabled:opacity-30'
  return (
    <div className="space-y-3">
      <BackBar />
      <Title sub="Create as many as you like">Templates</Title>
      <p className="text-sm text-mute">Templates marked “In rotation” are suggested one after another, in the order below.</p>
      <Link to="/routine/new" className="btn btn-primary flex items-center justify-center">+ New template</Link>
      <button className="btn w-full" onClick={findInHistory}>Find templates in my history</button>
      {list.length === 0 && <div className="card text-mute">No templates yet.</div>}
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
      {offer && h && <TemplateOfferSheet candidates={offer} exercises={h.exercises} onClose={() => setOffer(null)} />}
    </div>
  )
}
