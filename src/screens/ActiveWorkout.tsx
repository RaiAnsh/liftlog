import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useSettings } from '../db/settings'
import ExercisePicker from '../components/ExercisePicker'
import ExerciseThumb from '../components/ExerciseThumb'
import PlateCalculator from '../components/PlateCalculator'
import WarmupSheet from '../components/WarmupSheet'
import { describeTarget, metTarget, nextTarget, targetForSet, type Target } from '../coaching/targets'
import { livePR, type Bests } from '../lib/prs'
import { showToast } from '../lib/toast'
import Sheet, { SheetRow } from '../components/Sheet'
import { fmtClock, useNow } from '../lib/useNow'
import { formatWeight, toKg } from '../units'
import {
  addSet, addWarmups, completedSetCount, draftExercise, incompleteSetCount, moveExercise, patchExercise, previousFor, removeExercise,
  removeSet, swapExercise, toggleComplete, toggleSuperset, updateSet,
} from '../workout/draft'
import { getBests, getPreviousSets } from '../workout/previous'
import { discardDraft, finishDraft, getDraft, updateDraft } from '../workout/store'
import type { ActiveWorkout as Draft, DraftExercise, DraftSet, Exercise, SetType, Unit, WorkoutSet } from '../types'

const TYPES: { t: SetType; label: string; tag: string; cls: string }[] = [
  { t: 'working', label: 'Working set', tag: '', cls: '' },
  { t: 'warmup', label: 'Warm-up', tag: 'W', cls: 'text-warn' },
  { t: 'drop', label: 'Drop set', tag: 'D', cls: 'text-accent' },
  { t: 'failure', label: 'Failure', tag: 'F', cls: 'text-red-500' },
]
const REST_CHOICES = [0, 30, 60, 90, 120, 180, 240, 300]
const fmtRest = (s: number) => (s === 0 ? 'Off' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
const parseNum = (t: string): number | null => {
  const n = Number(t.replace(',', '.'))
  return t.trim() === '' || Number.isNaN(n) ? null : n
}

/** Text input that keeps what's being typed ("12." stays "12.") and reports the parsed number. */
function NumInput({ value, placeholder, mode, onCommit, bad }: { value: number | null; placeholder?: string; mode: 'decimal' | 'numeric'; onCommit: (v: number | null) => void; bad?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => { if (parseNum(text) !== value) setText(value === null ? '' : String(value)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      value={text} inputMode={mode} placeholder={placeholder} enterKeyHint="next"
      onChange={(e) => { setText(e.target.value); onCommit(parseNum(e.target.value)) }}
      onFocus={(e) => e.target.select()}
      className={`num h-11 w-full rounded-lg bg-card2 text-center text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-mute/60 focus:ring-2 focus:ring-accent ${bad ? 'ring-2 ring-red-500' : ''}`}
    />
  )
}

function SetRow({ ex, set, index, prev, units, bests, target }: { ex: DraftExercise; set: DraftSet; index: number; prev: WorkoutSet[] | undefined; units: Unit; bests: Bests | undefined; target: Target | null }) {
  const [menu, setMenu] = useState(false)
  const [bad, setBad] = useState(false)
  const p = previousFor(prev, ex.sets, index)
  const tag = TYPES.find((t) => t.t === set.type)!
  const number = ex.sets.slice(0, index + 1).filter((s) => s.type !== 'warmup').length
  const pw = p ? Number(formatWeight(p.weightKg, units)) : null
  const tg = targetForSet(target, ex.sets, index)
  const tw = tg ? Number(formatWeight(tg.weightKg, units)) : null
  const hit = set.completed && metTarget(set, tg)
  const patch = (x: Partial<DraftSet>) => updateDraft((d) => updateSet(d, ex.uid, set.uid, x))
  const cols = ex.showRpe ? 'grid-cols-[34px_1fr_66px_58px_46px_46px]' : 'grid-cols-[34px_1fr_72px_62px_46px]'

  function check() {
    const next = toggleComplete(getD(), ex.uid, set.uid, prev, Date.now(), target)
    if (next === getD()) { setBad(true); setTimeout(() => setBad(false), 900); return }
    updateDraft(() => next)
    const done = next.exercises.find((e) => e.uid === ex.uid)!.sets.find((x) => x.uid === set.uid)!
    const earlier = next.exercises.find((e) => e.uid === ex.uid)!.sets
      .filter((x) => x.uid !== set.uid && x.completed && x.type !== 'warmup')
      .map((x) => ({ weightKg: x.weightKg ?? 0, reps: x.reps ?? 0 }))
    const pr = done.completed && done.type !== 'warmup' ? livePR(bests, earlier, done.weightKg ?? 0, done.reps ?? 0) : null
    if (pr) {
      showToast('🏆 New PR!', { kind: 'pr', sub: pr === 'e1rm' ? 'Best estimated 1RM yet' : 'Heaviest weight yet' })
      navigator.vibrate?.([30, 40, 30])
    } else navigator.vibrate?.(8)
  }

  return (
    <>
      <div className={`num grid ${cols} items-center gap-1.5 rounded-xl px-1 py-1 transition-colors ${set.completed ? 'bg-good/15' : ''}`}>
        <button onClick={() => setMenu(true)} className={`h-11 font-bold ${tag.cls || 'text-mute'}`} aria-label="Set options">{tag.tag || number}</button>
        <button
          className="truncate text-left text-sm text-mute"
          onClick={() => p && patch({ weightKg: set.weightKg ?? p.weightKg, reps: set.reps ?? p.reps })}
        >
          {p ? (p.weightKg > 0 ? `${pw} × ${p.reps}` : `${p.reps} reps`) : '–'}
        </button>
        <NumInput value={set.weightKg === null ? null : Number(formatWeight(set.weightKg, units))} placeholder={tw && tw > 0 ? String(tw) : pw && pw > 0 ? String(pw) : units} mode="decimal"
          onCommit={(v) => patch({ weightKg: v === null ? null : toKg(v, units) })} />
        <NumInput value={set.reps} placeholder={tg ? String(tg.reps) : p ? String(p.reps) : ex.repMin ? String(ex.repMin) : ''} mode="numeric" bad={bad}
          onCommit={(v) => patch({ reps: v })} />
        {ex.showRpe && <NumInput value={set.rpe} placeholder="RPE" mode="decimal" onCommit={(v) => patch({ rpe: v })} />}
        <button onClick={check} aria-label={set.completed ? 'Mark incomplete' : 'Complete set'}
          className={`flex h-11 items-center justify-center rounded-lg text-xl font-bold transition active:scale-95 ${set.completed ? 'bg-good text-white' : 'bg-card2 text-mute'} ${hit ? 'ring-2 ring-good/60 ring-offset-2 ring-offset-card' : ''}`}>{hit ? '✓✓' : '✓'}</button>
      </div>
      {menu && (
        <Sheet title="Set type" onClose={() => setMenu(false)}>
          {TYPES.map((t) => <SheetRow key={t.t} on={set.type === t.t} onClick={() => { patch({ type: t.t }); setMenu(false) }}>{t.label}</SheetRow>)}
          <SheetRow danger onClick={() => { updateDraft((d) => removeSet(d, ex.uid, set.uid)); setMenu(false) }}>Delete set</SheetRow>
        </Sheet>
      )}
    </>
  )
}

const getD = () => getDraft()!

function ExerciseCard({ ex, def, prev, units, index, total, supersetLabel, bests, target }: {
  ex: DraftExercise; def: Exercise | undefined; prev: WorkoutSet[] | undefined; units: Unit; index: number; total: number; supersetLabel: string | null; bests: Bests | undefined; target: Target | null
}) {
  const [menu, setMenu] = useState(false)
  const [swap, setSwap] = useState(false)
  const [warm, setWarm] = useState(false)
  const [plates, setPlates] = useState(false)
  const name = def?.name ?? 'Exercise'
  const cols = ex.showRpe ? 'grid-cols-[34px_1fr_66px_58px_46px_46px]' : 'grid-cols-[34px_1fr_72px_62px_46px]'
  const pat = (x: Partial<DraftExercise>) => updateDraft((d) => patchExercise(d, ex.uid, x))

  return (
    <div className={`card ${supersetLabel ? 'border-l-4 border-accent' : ''}`}>
      <div className="mb-2 flex items-center gap-3">
        <ExerciseThumb name={name} muscle={def?.primaryMuscles[0]} size={46} />
        <button className="min-w-0 flex-1 text-left" onClick={() => setMenu(true)}>
          <div className="truncate text-[17px] font-bold text-accent">{name}</div>
          <div className="truncate text-xs text-mute">
            {supersetLabel && <span className="mr-2 font-semibold text-accent">Superset {supersetLabel}</span>}
            {ex.repMin && ex.repMax ? `${ex.repMin}–${ex.repMax} reps · ` : ''}rest {fmtRest(ex.restSeconds)}
          </div>
        </button>
        <button onClick={() => setMenu(true)} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-mute" aria-label="Exercise options">⋯</button>
      </div>
      {target && (
        <div className="mb-2 rounded-xl bg-accent/10 px-3 py-2">
          <div className="num text-sm font-bold text-accent">🎯 Target {describeTarget(target, (kg) => `${formatWeight(kg, units)} ${units}`)}</div>
          <div className="text-xs text-mute">{target.reason}</div>
        </div>
      )}
      <input
        value={ex.notes} onChange={(e) => pat({ notes: e.target.value })} placeholder="Add note…"
        className="mb-2 w-full bg-transparent px-1 text-sm outline-none placeholder:text-mute/70"
      />
      <div className={`label mb-1 grid ${cols} gap-1.5 px-1 text-center`}>
        <span>Set</span><span className="text-left">Previous</span><span>{units}</span><span>Reps</span>{ex.showRpe && <span>RPE</span>}<span>✓</span>
      </div>
      <div className="space-y-1">
        {ex.sets.map((s, i) => <SetRow key={s.uid} ex={ex} set={s} index={i} prev={prev} units={units} bests={bests} target={target} />)}
      </div>
      <button className="btn mt-2 w-full" onClick={() => updateDraft((d) => addSet(d, ex.uid))}>+ Add set</button>

      {menu && (
        <Sheet title={name} onClose={() => setMenu(false)}>
          <SheetRow onClick={() => { setMenu(false); setWarm(true) }}>Add warm-up sets</SheetRow>
          {def?.equipment === 'barbell' && <SheetRow onClick={() => { setMenu(false); setPlates(true) }}>Plate calculator</SheetRow>}
          <SheetRow onClick={() => { setMenu(false); setSwap(true) }}>Swap exercise</SheetRow>
          <SheetRow onClick={() => { updateDraft((d) => moveExercise(d, ex.uid, -1)); setMenu(false) }}>{index === 0 ? 'Move up (already first)' : 'Move up'}</SheetRow>
          <SheetRow onClick={() => { updateDraft((d) => moveExercise(d, ex.uid, 1)); setMenu(false) }}>{index === total - 1 ? 'Move down (already last)' : 'Move down'}</SheetRow>
          <SheetRow onClick={() => { updateDraft((d) => toggleSuperset(d, ex.uid)); setMenu(false) }}>
            {ex.superset !== null ? 'Remove from superset' : index === total - 1 ? 'Superset with next (none below)' : 'Superset with next exercise'}
          </SheetRow>
          <SheetRow on={ex.showRpe} onClick={() => pat({ showRpe: !ex.showRpe })}>Track RPE</SheetRow>
          <div className="border-t border-line px-1 py-3">
            <div className="mb-2 text-[17px]">Rest timer</div>
            <div className="flex flex-wrap gap-2">
              {REST_CHOICES.map((r) => <button key={r} className={`chip flex items-center ${ex.restSeconds === r ? 'chip-on' : ''}`} onClick={() => pat({ restSeconds: r })}>{fmtRest(r)}</button>)}
            </div>
          </div>
          <SheetRow danger onClick={() => { if (confirm(`Remove ${name} from this workout?`)) { updateDraft((d) => removeExercise(d, ex.uid)); setMenu(false) } }}>Remove exercise</SheetRow>
        </Sheet>
      )}
      {warm && (
        <WarmupSheet ex={def} onClose={() => setWarm(false)}
          initialKg={ex.sets.find((x) => x.type !== 'warmup' && x.weightKg)?.weightKg ?? prev?.find((x) => x.type !== 'warmup' && x.weightKg > 0)?.weightKg ?? null}
          onAdd={(w) => { updateDraft((d) => addWarmups(d, ex.uid, w)); setWarm(false) }} />
      )}
      {plates && (
        <Sheet title="Plate calculator" onClose={() => setPlates(false)}>
          <PlateCalculator initialKg={ex.sets.find((x) => x.type !== 'warmup' && x.weightKg)?.weightKg ?? prev?.find((x) => x.type !== 'warmup' && x.weightKg > 0)?.weightKg ?? null} />
        </Sheet>
      )}
      {swap && <ExercisePicker onClose={() => setSwap(false)} onPick={([e]) => { updateDraft((d) => swapExercise(d, ex.uid, e)); setSwap(false) }} />}
    </div>
  )
}

export default function ActiveWorkout({ draft }: { draft: Draft }) {
  const nav = useNavigate()
  const { units, defaultRestSeconds, coachState } = useSettings()
  const now = useNow(1000)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const exMap = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), [])
  const ids = draft.exercises.map((e) => e.exerciseId)
  const prev = useLiveQuery(() => getPreviousSets(ids), [ids.join(',')])
  const bests = useLiveQuery(() => getBests(ids), [ids.join(',')])

  const targets = useMemo(() => {
    const m = new Map<string, Target | null>()
    for (const ex of draft.exercises) {
      const def = exMap?.get(ex.exerciseId)
      m.set(ex.uid, def ? nextTarget(prev?.get(ex.exerciseId), {
        repMin: ex.repMin ?? def.repRangeMin, repMax: ex.repMax ?? def.repRangeMax, incrementKg: def.weightIncrement,
        fmt: (kg) => `${formatWeight(kg, units)} ${units}`, deload: ex.exerciseId in coachState.deload,
      }) : null)
    }
    return m
  }, [draft.exercises, exMap, prev, units, coachState])

  const groups = [...new Set(draft.exercises.map((e) => e.superset).filter((g): g is number => g !== null))]

  if (!exMap || !prev) return <p className="text-mute">Loading…</p>

  async function finish() {
    const done = completedSetCount(draft), open = incompleteSetCount(draft)
    if (done === 0) {
      if (confirm('No sets were completed. Discard this workout?')) { await discardDraft() }
      return
    }
    if (open > 0 && !confirm(`${open} unfinished set${open === 1 ? '' : 's'} won't be saved. Finish workout?`)) return
    setBusy(true)
    const id = await finishDraft()
    nav(id ? `/history/${id}?done=1` : '/history', { replace: true })
  }

  async function discard() {
    if (confirm('Discard this workout? Everything logged so far will be lost.')) await discardDraft()
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-bg/90 px-4 py-2 backdrop-blur">
        <div className="num flex items-center gap-2 text-lg font-semibold"><span className="text-mute">⏱</span>{fmtClock(now - draft.startedAt)}</div>
        <button className="btn btn-primary !min-h-[40px] px-5 disabled:opacity-50" disabled={busy} onClick={finish}>Finish</button>
      </div>

      <input
        value={draft.name} onChange={(e) => updateDraft((d) => ({ ...d, name: e.target.value }))} aria-label="Workout name"
        className="w-full bg-transparent text-[30px] font-extrabold leading-tight tracking-tight outline-none"
      />
      <textarea
        value={draft.notes} onChange={(e) => updateDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Workout notes…" rows={1}
        className="w-full resize-none bg-transparent text-mute outline-none placeholder:text-mute/70"
      />

      {draft.exercises.length === 0 && <div className="card text-center text-mute">Add your first exercise to get started.</div>}

      {draft.exercises.map((ex, i) => (
        <ExerciseCard key={ex.uid} ex={ex} def={exMap?.get(ex.exerciseId)} prev={prev?.get(ex.exerciseId)} bests={bests?.get(ex.exerciseId)} target={targets.get(ex.uid) ?? null} units={units}
          index={i} total={draft.exercises.length}
          supersetLabel={ex.superset === null ? null : String.fromCharCode(65 + groups.indexOf(ex.superset))} />
      ))}

      <button className="btn btn-primary w-full" onClick={() => setAdding(true)}>+ Add exercise</button>
      <button className="btn btn-danger w-full" onClick={discard}>Discard workout</button>

      {adding && (
        <ExercisePicker multi onClose={() => setAdding(false)} onPick={(list) => {
          updateDraft((d) => ({ ...d, exercises: [...d.exercises, ...list.map((e) => draftExercise(e, { restSeconds: defaultRestSeconds }))] }))
          setAdding(false)
        }} />
      )}
    </div>
  )
}
