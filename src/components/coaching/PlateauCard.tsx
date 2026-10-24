import { useState } from 'react'
import { Link } from 'react-router-dom'
import Sheet, { SheetRow } from '../Sheet'
import ExerciseThumb from '../ExerciseThumb'
import { db } from '../../db/db'
import { setSetting } from '../../db/settings'
import { REP_RANGE_PRESETS, similarExercises } from '../../coaching/plateau'
import type { PlateauItem } from '../../coaching/useCoaching'
import { showToast } from '../../lib/toast'
import { formatWeight } from '../../units'
import type { Exercise, Settings } from '../../types'

/** Offered when a lift hasn't improved in 3 sessions. The user picks an option or dismisses; nothing is forced. */
export default function PlateauCard({ item, settings, all, usage }: { item: PlateauItem; settings: Settings; all: Map<number, Exercise>; usage: Map<number, number> }) {
  const [sheet, setSheet] = useState<'range' | 'swap' | null>(null)
  const { exercise: ex, plateau, points } = item
  const cs = settings.coachState
  const hide = () => setSetting('coachState', { ...cs, dismissed: { ...cs.dismissed, [ex.id!]: points.length } })

  async function deload() {
    await setSetting('coachState', { ...cs, deload: { ...cs.deload, [ex.id!]: Date.now() }, dismissed: { ...cs.dismissed, [ex.id!]: points.length } })
    showToast('Deload set', { sub: `Next session’s ${ex.name} targets will be 10% lighter.` })
  }

  async function setRange(min: number, max: number) {
    await db.transaction('rw', db.exercises, db.routines, async () => {
      await db.exercises.update(ex.id!, { repRangeMin: min, repRangeMax: max })
      for (const r of await db.routines.toArray()) {
        if (r.items.some((i) => i.exerciseId === ex.id)) await db.routines.update(r.id!, { items: r.items.map((i) => (i.exerciseId === ex.id ? { ...i, repRangeMin: min, repRangeMax: max } : i)) })
      }
    })
    await hide()
    setSheet(null)
    showToast(`Rep range ${min}–${max}`, { sub: `Applied to ${ex.name} and your templates.` })
  }

  async function swapTo(to: Exercise) {
    let n = 0
    await db.transaction('rw', db.routines, async () => {
      for (const r of await db.routines.toArray()) {
        if (r.items.some((i) => i.exerciseId === ex.id)) { n++; await db.routines.update(r.id!, { items: r.items.map((i) => (i.exerciseId === ex.id ? { ...i, exerciseId: to.id! } : i)) }) }
      }
    })
    await hide()
    setSheet(null)
    showToast(n ? `Swapped to ${to.name}` : 'Not in any template', { sub: n ? `Replaced in ${n} template${n === 1 ? '' : 's'}.` : `Add ${to.name} when you next log a workout.` })
  }

  const alts = sheet === 'swap' ? similarExercises(ex, [...all.values()], usage).slice(0, 8) : []
  const w = `${formatWeight(plateau.topWeightKg, settings.units)} ${settings.units}`

  return (
    <div className="card space-y-3 border border-warn/40">
      <Link to={`/exercise/${encodeURIComponent(ex.nameKey)}`} className="flex items-center gap-3">
        <ExerciseThumb name={ex.name} muscles={ex.primaryMuscles} secondary={ex.secondaryMuscles} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{ex.name} has stalled</div>
          <div className="text-sm text-mute">No gain in top weight or est. 1RM over the last 3 sessions (latest top set {w}).</div>
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn !min-h-[44px] !px-2 text-sm" onClick={deload}>Deload 10%</button>
        <button className="btn !min-h-[44px] !px-2 text-sm" onClick={() => setSheet('range')}>Change reps</button>
        <button className="btn !min-h-[44px] !px-2 text-sm" onClick={() => setSheet('swap')}>Swap lift</button>
      </div>
      <button className="w-full text-center text-sm text-mute" onClick={hide}>Dismiss until my next session</button>

      {sheet === 'range' && (
        <Sheet title="Switch rep range" onClose={() => setSheet(null)}>
          <p className="mb-2 text-center text-sm text-mute">Currently {ex.repRangeMin}–{ex.repRangeMax}. Targets and progression follow the new range.</p>
          {REP_RANGE_PRESETS.map((p) => <SheetRow key={p.label} on={p.min === ex.repRangeMin && p.max === ex.repRangeMax} onClick={() => setRange(p.min, p.max)}>{p.label}</SheetRow>)}
        </Sheet>
      )}
      {sheet === 'swap' && (
        <Sheet title="Swap for a similar lift" onClose={() => setSheet(null)}>
          {alts.length === 0 && <p className="text-center text-mute">No other exercises for this muscle yet. Add some from the library.</p>}
          {alts.map((a) => <SheetRow key={a.id} onClick={() => swapTo(a)}>{a.name}</SheetRow>)}
        </Sheet>
      )}
    </div>
  )
}
