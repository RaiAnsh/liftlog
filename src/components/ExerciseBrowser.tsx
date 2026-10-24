import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { GROUPS, organize, type GroupId, type Scope } from '../lib/exerciseGroups'
import type { ExerciseItem } from '../lib/useExerciseItems'
import { SearchIcon } from './Icons'

const SCOPES: [Scope, string][] = [['all', 'Everything'], ['mine', 'My exercises'], ['pf', 'Planet Fitness']]
const TABS: { id: GroupId | 'all'; label: string; color?: string }[] = [{ id: 'all', label: 'All' }, ...GROUPS.filter((g) => g.id !== 'other').map((g) => ({ id: g.id, label: g.label, color: g.color }))]

/**
 * The exercise list, organised the way people think about a split: a Push / Pull / Legs / Core switcher,
 * then sections by muscle (Chest, Shoulders, Triceps…). Your most-used exercises come first in each
 * section and long sections fold behind "Show more". Used by both the picker and the Exercises tab.
 */
export default function ExerciseBrowser({ items, renderRow, stickyTop = '0px' }: {
  items: ExerciseItem[] | undefined; renderRow: (item: ExerciseItem) => ReactNode; stickyTop?: string
}) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [group, setGroup] = useState<GroupId | 'all'>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const dq = useDeferredValue(q)

  const sections = useMemo(() => organize(items ?? [], { query: dq, scope, group }), [items, dq, scope, group])
  const counts = useMemo(() => {
    const c: Partial<Record<GroupId, number>> = {}
    for (const s of organize(items ?? [], { query: dq, scope })) c[s.group.id] = (c[s.group.id] ?? 0) + s.items.length
    return c
  }, [items, dq, scope])

  const limit = dq.trim() ? Infinity : group === 'all' ? 4 : 8
  let lastGroup = ''

  return (
    <div>
      <div className="sticky z-10 -mx-4 space-y-2.5 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur" style={{ top: stickyTop }}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><SearchIcon /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises"
            className="w-full rounded-2xl bg-card py-3 pl-10 pr-4 outline-none placeholder:text-mute focus:ring-2 focus:ring-accent" />
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-card p-1" role="tablist">
          {TABS.map((t) => {
            const on = group === t.id
            const n = t.id === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[t.id] ?? 0)
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setGroup(t.id)}
                className={`press relative rounded-xl py-2 text-[13px] font-bold transition-colors ${on ? 'bg-card2 text-fg shadow' : 'text-mute'}`}>
                {t.color && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: t.color }} />}
                {t.label}
                <span className="block text-[10px] font-medium text-mute">{n}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-center gap-1 text-xs">
          {SCOPES.map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${scope === k ? 'bg-accent/15 text-accent' : 'text-mute'}`}>{l}</button>
          ))}
        </div>
      </div>

      {!items && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>}
      {items && sections.length === 0 && (
        <div className="card text-center text-mute">
          {dq.trim() ? <>No exercises match “{dq.trim()}”.</> : 'Nothing here yet.'}
          {(scope !== 'all' || group !== 'all') && <button className="mt-2 block w-full text-sm font-semibold text-accent" onClick={() => { setScope('all'); setGroup('all') }}>Show everything</button>}
        </div>
      )}

      <div className="space-y-4">
        {sections.map((s) => {
          const key = `${s.group.id}/${s.section.id}`
          const expanded = open.has(key)
          const shown = expanded ? s.items : s.items.slice(0, limit)
          const heading = group === 'all' && s.group.id !== lastGroup && s.group.id !== 'other'
          lastGroup = s.group.id
          return (
            <section key={key}>
              {heading && (
                <div className="mb-2 mt-2 flex items-baseline gap-2">
                  <span className="inline-block h-3 w-3 translate-y-px rounded-full" style={{ background: s.group.color }} />
                  <h2 className="text-xl font-extrabold tracking-tight">{s.group.label}</h2>
                  <span className="text-sm text-mute">{s.group.blurb}</span>
                </div>
              )}
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="label">{s.section.label}</span>
                <span className="text-xs text-mute">{s.items.length}</span>
              </div>
              <div className="overflow-hidden rounded-2xl bg-card">
                {shown.map((it, i) => <div key={it.key} className={i ? 'border-t border-line' : ''}>{renderRow(it)}</div>)}
                {s.items.length > limit && (
                  <button className="row-press w-full border-t border-line py-3 text-sm font-semibold text-accent" onClick={() => setOpen((p) => { const n = new Set(p); if (expanded) n.delete(key); else n.add(key); return n })}>
                    {expanded ? 'Show less' : `Show ${s.items.length - limit} more`}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
