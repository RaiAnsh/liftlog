import { Link } from 'react-router-dom'
import type { compute } from '../../coaching/useCoaching'
import { fmtSets } from '../../coaching/volume'
import type { History } from '../../coaching/types'
import { formatWeight } from '../../units'
import { MUSCLE_LABELS, type Settings } from '../../types'

type C = ReturnType<typeof compute>
const lc = (s: string) => s.toLowerCase()

/** Informational cards: late-week shortfalls, muscles untouched for 8+ days, and the fatigue signal. Never blocking. */
export default function Alerts({ c, h, settings }: { c: C; h: History; settings: Settings }) {
  const u = settings.units
  return (
    <>
      {c.late && (
        <div className="card border border-warn/40">
          <div className="font-bold text-warn">Behind this week</div>
          <p className="mt-1 text-sm">{c.late.text}</p>
          <Link to="/profile" className="mt-2 inline-block text-sm text-accent">See your muscle map →</Link>
        </div>
      )}
      {c.stale.length > 0 && (
        <div className="card">
          <div className="font-bold">Not trained in a while</div>
          <p className="mt-1 text-sm text-mute">
            {c.stale.slice(0, 5).map((x) => `${lc(MUSCLE_LABELS[x.muscle])} (${x.days} days)`).join(', ')}
            {c.stale.length > 5 ? ` and ${c.stale.length - 5} more` : ''}.
          </p>
        </div>
      )}
      {c.fatigue && (
        <div className="card border border-warn/40">
          <div className="font-bold text-warn">You may be getting fatigued</div>
          <p className="mt-1 text-sm">
            The same weights feel harder than two weeks ago:{' '}
            {c.fatigue.slice(0, 3).map((f) => `${h.exercises.get(f.exerciseId)?.name} ${formatWeight(f.weightKg, u)} ${u} × ${f.reps} (RPE ${fmtSets(Math.round(f.rpeBefore * 10) / 10)} → ${f.rpeNow})`).join('; ')}.
          </p>
          <p className="mt-1 text-sm text-mute">Consider a lighter week: about 10% less weight or one set fewer per exercise.</p>
        </div>
      )}
    </>
  )
}
