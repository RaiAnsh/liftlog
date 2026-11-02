import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyFix } from '../../coaching/actions'
import { goalLabel, priorityMuscles, STYLE_LABEL, STYLE_RANGE } from '../../coaching/goals'
import { programReview } from '../../coaching/hypertrophy'
import type { History } from '../../coaching/types'
import { setSetting } from '../../db/settings'
import { useExerciseItems } from '../../lib/useExerciseItems'
import { showToast } from '../../lib/toast'
import { MUSCLE_LABELS, type Settings } from '../../types'
import GoalSheet from '../GoalSheet'

const ICON = { add: '➕', frequency: '🔀', trim: '✂️' } as const
const DAY = 86_400_000
const fmtD = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * The hypertrophy coach: your goal, and a review of what your last few training weeks actually delivered,
 * with one-tap fixes that edit your templates (e.g. "Add 3 sets of Lateral Raise to Push").
 */
export default function CoachSection({ h, settings, now }: { h: History; settings: Settings; now: number }) {
  const items = useExerciseItems()
  const [goalOpen, setGoalOpen] = useState(false)
  const applied = settings.coachState.applied ?? {}

  const review = useMemo(() => programReview({
    h, goal: settings.goal, targets: settings.weeklyTargets, now, startDay: settings.weekStartDay, phase: settings.phase,
    candidates: (items ?? []).map((i) => ({ key: i.key, name: i.name, muscles: i.muscles, mine: i.mine, sets: i.sets })),
  }), [h, settings.goal, settings.weeklyTargets, settings.weekStartDay, settings.phase, now, items])

  async function apply(id: string, fix: NonNullable<ReturnType<typeof programReview>>['items'][number]['fix']) {
    if (!fix) return
    const ok = await applyFix(fix, settings.units)
    await setSetting('coachState', { ...settings.coachState, applied: { ...applied, [id]: Date.now() } })
    showToast(ok ? `Added to ${fix.routineName}` : 'Already in that template', { sub: ok ? `${fix.sets} sets of ${fix.exerciseName}. Edit it any time in Templates.` : undefined })
  }

  const visible = (review?.items ?? []).filter((i) => !(applied[i.id] && now - applied[i.id] < 14 * DAY))
  const prio = priorityMuscles(settings.goal)

  return (
    <section className="space-y-3">
      <div className="label">Coach</div>

      <div className="rise card space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-mute">Your goal</div>
            <div className="text-lg font-extrabold leading-tight">{goalLabel(settings.goal) ?? 'Not set yet'}</div>
            <div className="mt-0.5 text-xs font-semibold text-mute">{settings.phase === 'cut' ? '🔥 Cutting: hold your strength' : settings.phase === 'maintain' ? 'Maintaining' : 'Building'} · {STYLE_LABEL[settings.volumeStyle]} volume</div>
          </div>
          <button className="press rounded-xl bg-card2 px-3 py-2 text-sm font-semibold text-accent" onClick={() => setGoalOpen(true)}>{settings.goal ? 'Change' : 'Choose'}</button>
        </div>
        {settings.goal ? (
          <div className="flex flex-wrap gap-1.5">
            {prio.length ? prio.map((m) => <span key={m} className="chip chip-on flex items-center !min-h-[28px] text-xs">{MUSCLE_LABELS[m]}</span>) : <span className="text-sm text-mute">Every muscle gets steady volume ({STYLE_RANGE[settings.volumeStyle].standard.min}–{STYLE_RANGE[settings.volumeStyle].standard.max} sets a week).</span>}
          </div>
        ) : <p className="text-sm text-mute">Tell LiftLog what you want to build and it tunes your weekly sets and suggestions.</p>}
      </div>

      {!review ? (
        <div className="card text-sm text-mute">Once you have a couple of training weeks logged, the coach reviews your program and suggests changes here.</div>
      ) : visible.length === 0 ? (
        <div className="rise card text-sm"><b>Nothing to fix. 🎉</b> <span className="text-mute">Your last {review.weeks} training weeks line up with your goal.</span></div>
      ) : (
        visible.map((it, i) => (
          <div key={it.id} className="rise card space-y-2" style={{ ['--i' as string]: i + 1 }}>
            <div className="flex items-start gap-2.5">
              <span className="text-xl" aria-hidden>{ICON[it.kind]}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold leading-tight">{it.title}</div>
                <div className="mt-0.5 text-sm text-mute">{it.detail}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {it.fix && <button className="btn btn-primary press !min-h-[42px] flex-1 !text-[15px]" onClick={() => apply(it.id, it.fix)}>Add {it.fix.sets} sets of {it.fix.exerciseName.replace(/ \(.*\)$/, '')} to {it.fix.routineName}</button>}
              <Link to={`/science?s=${it.sci}`} className="shrink-0 text-sm font-semibold text-accent">Why?</Link>
            </div>
          </div>
        ))
      )}
      {review && <p className="px-1 text-xs text-mute">Based on your last {review.weeks} training weeks ({fmtD(review.from)} – {fmtD(review.to)}). <Link to="/science" className="text-accent">The science</Link></p>}
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
    </section>
  )
}
