import { useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { CountUp } from '../Motion'
import type { WeekTotals } from '../../coaching/volume'
import { fromKg } from '../../units'
import type { Unit } from '../../types'

type Metric = 'workouts' | 'sets' | 'volume'
const LABEL: Record<Metric, string> = { workouts: 'Workouts', sets: 'Sets', volume: 'Volume' }

/** Strong-style weekly bars on the Profile: workouts, hard sets, or volume for the last 10 weeks. */
export default function WeeklyChart({ totals, units }: { totals: WeekTotals[]; units: Unit }) {
  const [metric, setMetric] = useState<Metric>('workouts')
  const val = (t: WeekTotals) => (metric === 'workouts' ? t.workouts : metric === 'sets' ? t.sets : Math.round(fromKg(t.volumeKg, units)))
  const data = totals.map((t, i) => ({ i, label: new Date(t.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), v: val(t), current: i === totals.length - 1 }))
  const cur = data[data.length - 1]?.v ?? 0
  const unit = metric === 'volume' ? ` ${units}` : ''

  return (
    <section className="card">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="label">This week</div>
          <div className="num text-3xl font-extrabold leading-none"><CountUp value={cur} />{unit && <span className="ml-1 text-base font-semibold text-mute">{units}</span>}</div>
          <div className="mt-1 text-xs text-mute">{LABEL[metric].toLowerCase()}</div>
        </div>
        <div className="flex rounded-xl bg-card2 p-1">
          {(Object.keys(LABEL) as Metric[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${metric === m ? 'bg-accent text-white' : 'text-mute'}`}>{LABEL[m]}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: 'rgb(var(--mute))', fontSize: 10 }} minTickGap={24} />
          <Tooltip cursor={{ fill: 'rgb(var(--card2))' }} content={({ active, payload }) => active && payload?.length ? (
            <div className="rounded-xl bg-card2 px-3 py-1.5 text-sm shadow-lg"><b className="num">{Number((payload[0].payload as { v: number }).v).toLocaleString()}{unit}</b> <span className="text-mute">wk of {(payload[0].payload as { label: string }).label}</span></div>
          ) : null} />
          <Bar dataKey="v" radius={[5, 5, 0, 0]} animationDuration={800}>
            {data.map((d) => <Cell key={d.i} fill={d.current ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.38)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 text-center text-[11px] text-mute">Last 10 weeks</div>
    </section>
  )
}
