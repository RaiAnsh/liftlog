import { useEffect, useState } from 'react'
import { archiveExercise, saveExercise } from '../db/exercises'
import { useSettings } from '../db/settings'
import { guessEquipment, guessMuscles } from '../import/exerciseMap'
import { GROUPS } from '../lib/exerciseGroups'
import { showToast } from '../lib/toast'
import { MUSCLE_LABELS, type Equipment, type Exercise, type Muscle } from '../types'
import MuscleFigure, { viewFor } from './MuscleFigure'
import Sheet from './Sheet'

const EQUIPMENT: [Equipment, string][] = [['barbell', 'Barbell'], ['dumbbell', 'Dumbbell'], ['machine', 'Machine'], ['cable', 'Cable'], ['bodyweight', 'Bodyweight'], ['other', 'Other']]
type State = 'main' | 'also' | undefined

/**
 * Create your own exercise, or correct one you have: name it, say what equipment it uses, and tap the muscles it works.
 * Tap once for a main muscle, again for "also works", again to clear. Those tags are what your weekly volume,
 * goal targets, coach tips and Push/Pull/Legs filing all use, so a custom exercise behaves like any built-in one.
 */
export default function ExerciseFormSheet({ initialName = '', exercise, onSaved, onClose }: {
  initialName?: string; exercise?: Exercise; onSaved: (e: Exercise) => void; onClose: () => void
}) {
  const { units } = useSettings()
  const editing = !!exercise
  const nameLocked = !!exercise && !exercise.isCustom
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'other')
  const [cardio, setCardio] = useState(exercise ? exercise.primaryMuscles.length === 0 && exercise.cardio !== false && !exercise.needsReview : false)
  const [tags, setTags] = useState<Partial<Record<Muscle, State>>>(() => {
    const t: Partial<Record<Muscle, State>> = {}
    for (const m of exercise?.primaryMuscles ?? []) t[m] = 'main'
    for (const m of exercise?.secondaryMuscles ?? []) t[m] = 'also'
    return t
  })
  const [touched, setTouched] = useState(editing)
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // While the lifter hasn't touched anything, suggest equipment and muscles from what they typed.
  useEffect(() => {
    if (touched) return
    const g = guessMuscles(name)
    if (!name.trim() || !g.known) { setHint(null); return }
    const t: Partial<Record<Muscle, State>> = {}
    for (const m of g.primary) t[m] = 'main'
    for (const m of g.secondary) t[m] = 'also'
    setTags(t); setEquipment(guessEquipment(name)); setCardio(g.primary.length === 0)
    setHint(g.primary.length ? `Suggested from the name: ${g.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}. Change anything that's wrong.` : 'Looks like cardio.')
  }, [name, touched])

  const primary = (Object.keys(tags) as Muscle[]).filter((m) => tags[m] === 'main')
  const secondary = (Object.keys(tags) as Muscle[]).filter((m) => tags[m] === 'also')
  const cycle = (m: Muscle) => { setTouched(true); setHint(null); setCardio(false); setTags((t) => ({ ...t, [m]: t[m] === undefined ? 'main' : t[m] === 'main' ? 'also' : undefined })) }
  const canSave = name.trim().length >= 2 && (cardio || primary.length > 0)

  async function save() {
    setBusy(true); setError('')
    const r = await saveExercise({ name, equipment, primary: cardio ? [] : primary, secondary: cardio ? [] : secondary }, units, undefined, exercise?.id)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    showToast(editing ? 'Exercise updated' : 'Exercise added', { sub: cardio ? 'Logged as time and distance.' : `Counts toward ${primary.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(', ')} in your weekly volume.` })
    onSaved(r.exercise)
  }

  async function hide() {
    if (!exercise || !confirm(`Hide “${exercise.name}”? Your past workouts keep their sets.`)) return
    await archiveExercise(exercise.id!)
    onClose()
  }

  return (
    <Sheet title={editing ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <div className="label mb-1">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={nameLocked} placeholder="e.g. Hip Thrust (Machine)" autoCapitalize="words"
            className="w-full rounded-xl bg-card2 px-4 py-3 text-[17px] outline-none placeholder:text-mute/60 focus:ring-2 focus:ring-accent disabled:opacity-60" />
          {nameLocked && <div className="mt-1 text-xs text-mute">Built-in and imported exercises keep their name so your history stays linked. You can still fix the muscles.</div>}
        </label>

        <div>
          <div className="label mb-1.5">Equipment</div>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map(([k, l]) => <button key={k} onClick={() => { setTouched(true); setEquipment(k) }} className={`chip flex items-center ${equipment === k ? 'chip-on' : ''}`}>{l}</button>)}
          </div>
        </div>

        <button onClick={() => { setTouched(true); setHint(null); setCardio((c) => !c); setTags({}) }}
          className={`press flex w-full items-center justify-between rounded-xl px-4 py-3 text-left ${cardio ? 'bg-accent/15 ring-2 ring-accent' : 'bg-card2'}`}>
          <span><b className="block">Cardio</b><span className="text-sm text-mute">Logged as time and distance, no muscles</span></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${cardio ? 'border-transparent bg-accent text-white' : 'border-line'}`}>{cardio ? '✓' : ''}</span>
        </button>

        {!cardio && (
          <div>
            <div className="mb-1.5 flex items-end justify-between">
              <div className="label">Muscles it works</div>
              <div className="flex gap-3 text-[11px] text-mute"><span><b className="text-accent">●</b> main</span><span><b className="text-accent/45">●</b> also works</span></div>
            </div>
            {hint && <div className="mb-2 rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">{hint}</div>}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                {GROUPS.filter((g) => g.id !== 'other').map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-mute"><span className="inline-block h-2 w-2 rounded-full" style={{ background: g.color }} />{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.sections.flatMap((s) => s.muscles).map((m) => (
                        <button key={m} onClick={() => cycle(m)} aria-pressed={!!tags[m]}
                          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${tags[m] === 'main' ? 'bg-accent text-white' : tags[m] === 'also' ? 'bg-accent/30 text-fg' : 'bg-card2 text-mute'}`}>
                          {MUSCLE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-20 shrink-0">
                <MuscleFigure view={viewFor(primary)} primary={primary} secondary={secondary} className="h-44 w-full" title="Preview" />
              </div>
            </div>
          </div>
        )}

        {error && <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</div>}
        <button className="btn btn-primary w-full disabled:opacity-40" disabled={!canSave || busy} onClick={save}>{editing ? 'Save changes' : 'Add exercise'}</button>
        {!canSave && name.trim().length >= 2 && !cardio && <p className="-mt-2 text-center text-xs text-mute">Pick at least one main muscle (or mark it cardio).</p>}
        {exercise?.isCustom && <button className="w-full text-center text-sm font-semibold text-red-500" onClick={hide}>Hide this exercise</button>}
      </div>
    </Sheet>
  )
}
