import { useNavigate } from 'react-router-dom'
import { describeTarget, nextTarget } from '../coaching/targets'
import { addExampleTemplate, type ExampleTemplate } from '../data/templates'
import { db } from '../db/db'
import { isCardio } from '../db/exercises'
import { guessMuscles } from '../import/exerciseMap'
import { formatWeight } from '../units'
import { startFromRoutine } from '../workout/draft'
import { startDraft } from '../workout/store'
import { showToast } from '../lib/toast'
import type { Exercise, Routine, Unit, WorkoutSet } from '../types'
import ExerciseThumb from './ExerciseThumb'
import Sheet from './Sheet'

/** A Strong-style template card: bold name, then a muted list of its exercises. */
export function TemplateCard({ title, lines, extra, onClick, index = 0, dashed }: {
  title: string; lines: string[]; extra?: string; onClick: () => void; index?: number; dashed?: boolean
}) {
  return (
    <button onClick={onClick} style={{ ['--i' as string]: index }}
      className={`rise press card flex min-h-[132px] flex-col text-left ${dashed ? 'border border-dashed border-line !bg-transparent' : ''}`}>
      <div className="mb-1.5 truncate text-[17px] font-bold">{title}</div>
      <div className="flex-1 space-y-0.5 text-[13px] leading-snug text-mute">
        {lines.slice(0, 4).map((l, i) => <div key={i} className="truncate">{l}</div>)}
        {lines.length > 4 && <div>+ {lines.length - 4} more</div>}
      </div>
      {extra && <div className="mt-2 text-xs text-mute/80">{extra}</div>}
    </button>
  )
}

const fmtW = (u: Unit) => (kg: number) => `${formatWeight(kg, u)} ${u}`

/** Preview of one of your templates, with next-session targets, and a Start button. */
export function TemplateSheet({ routine, exercises, prev, units, deload, hold, onClose }: {
  routine: Routine; exercises: Map<number, Exercise>; prev: Map<number, WorkoutSet[]>; units: Unit; deload: Record<number, number>; hold?: boolean; onClose: () => void
}) {
  const nav = useNavigate()
  return (
    <Sheet title={routine.name} onClose={onClose}>
      <div className="mb-3 space-y-1">
        {routine.items.map((it, k) => {
          const e = exercises.get(it.exerciseId)
          const t = e && !isCardio(e) ? nextTarget(prev.get(it.exerciseId), { repMin: it.repRangeMin, repMax: it.repRangeMax, incrementKg: e.weightIncrement, fmt: fmtW(units), deload: it.exerciseId in deload, hold }) : null
          return (
            <div key={k} className="rise flex items-center gap-3 rounded-xl py-1.5" style={{ ['--i' as string]: k }}>
              <ExerciseThumb name={e?.name ?? '?'} muscles={e?.primaryMuscles} secondary={e?.secondaryMuscles} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{e?.name ?? 'Unknown exercise'}</div>
                <div className="num truncate text-sm text-mute">
                  {t ? <span className="font-semibold text-accent">🎯 {describeTarget(t, fmtW(units))}</span> : `${it.targetSets} sets · ${it.repRangeMin}–${it.repRangeMax} reps`}
                </div>
                {t && <div className="truncate text-xs text-mute">{t.reason}</div>}
              </div>
            </div>
          )
        })}
        {routine.items.length === 0 && <p className="py-4 text-center text-mute">No exercises yet. Tap Edit to add some.</p>}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-primary" disabled={!routine.items.length} onClick={() => { startDraft(startFromRoutine(routine, exercises, Date.now())); onClose(); nav('/workout') }}>Start Workout</button>
        <button className="btn px-5" onClick={() => { onClose(); nav(`/routine/${routine.id}`) }}>Edit</button>
      </div>
    </Sheet>
  )
}

/** Preview of a built-in example template. Adding it creates a normal template you can edit. */
export function ExampleSheet({ tpl, exercises, units, onClose }: { tpl: ExampleTemplate; exercises: Map<number, Exercise>; units: Unit; onClose: () => void }) {
  const nav = useNavigate()
  const add = async (start: boolean) => {
    const id = await addExampleTemplate(tpl, units)
    onClose()
    if (start) {
      const r = (await db.routines.get(id))!
      const all = new Map((await db.exercises.toArray()).map((e) => [e.id!, e]))
      startDraft(startFromRoutine(r, all, Date.now()))
      nav('/workout')
    } else {
      showToast(`${tpl.name} added`, { sub: 'Find it under My Templates.' })
    }
  }
  const byName = new Map([...exercises.values()].map((e) => [e.nameKey, e]))
  return (
    <Sheet title={tpl.name} onClose={onClose}>
      <p className="mb-3 text-center text-sm text-mute">{tpl.blurb}. Built from common gym machines, cables and dumbbells; swap anything for what your gym has.</p>
      <div className="mb-3 space-y-1">
        {tpl.items.map((it, k) => {
          const mine = byName.get(it.name.toLowerCase())
          const g = guessMuscles(it.name)
          return (
            <div key={k} className="rise flex items-center gap-3 py-1.5" style={{ ['--i' as string]: k }}>
              <ExerciseThumb name={it.name} muscles={mine?.primaryMuscles ?? g.primary} secondary={mine?.secondaryMuscles ?? g.secondary} size={44} />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{it.name}</div><div className="text-sm text-mute">{it.sets} sets · {it.repMin}–{it.repMax} reps</div></div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => add(false)}>Add to My Templates</button>
        <button className="btn btn-primary" onClick={() => add(true)}>Add &amp; Start</button>
      </div>
    </Sheet>
  )
}
