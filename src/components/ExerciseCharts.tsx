import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { inRange, type Range, type SessionPoint } from '../lib/exerciseStats'
import { fromKg } from '../units'
import type { Unit } from '../types'

type Metric = 'weight' | 'e1rm' | 'volume'
const METRICS: { k: Metric; label: string }[] = [{ k: 'weight', label: 'Top weight' }, { k: 'e1rm', label: 'Est. 1RM' }, { k: 'volume', label: 'Volume' }]
const RANGES: Range[] = ['3M', '6M', '1Y', 'All']
const ACCENT = 'rgb(var(--accent))'
const MUTE = 'rgb(var(--mute))'
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function ExerciseCharts({ points, units }: { points: SessionPoint[]; units: Unit }) {
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [range, setRange] = useState<Range>('6M')

  const data = useMemo(
    () => inRange(points, range)
      .map((p) => ({
        date: p.date, name: p.workoutName,
        value: Math.round(fromKg(metric === 'weight' ? p.topWeightKg : metric === 'e1rm' ? p.e1rmKg : p.volumeKg, units) * 10) / 10,
      }))
      .filter((d) => d.value > 0),
    [points, range, metric, units],
  )

  const axis = { stroke: MUTE, tick: { fill: MUTE, fontSize: 11 }, tickLine: false, axisLine: false } as const
  const tip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as { date: number; value: number; name: string }
    return (
      <div className="rounded-xl bg-card2 px-3 py-2 shadow-lg">
        <div className="num text-lg font-bold">{d.value.toLocaleString()} {units}</div>
        <div className="text-xs text-mute">{new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {d.name}</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl bg-card2 p-1">
        {METRICS.map((m) => (
          <button key={m.k} onClick={() => setMetric(m.k)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${metric === m.k ? 'bg-accent text-white' : 'text-mute'}`}>{m.label}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {RANGES.map((r) => <button key={r} onClick={() => setRange(r)} className={`chip flex flex-1 items-center justify-center ${range === r ? 'chip-on' : ''}`}>{r}</button>)}
      </div>
      <div className="card !px-1 !py-3">
        {data.length < 2 ? (
          <div className="flex h-56 items-center justify-center px-6 text-center text-mute">
            {data.length === 0 ? 'No sessions in this range.' : 'Log one more session to see a trend.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            {metric === 'volume' ? (
              <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate} {...axis} minTickGap={40} />
                <YAxis {...axis} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                <Tooltip content={tip} cursor={{ fill: 'rgb(var(--card2))' }} />
                <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="date" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate} {...axis} minTickGap={40} />
                <YAxis {...axis} width={48} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} />
                <Tooltip content={tip} />
                <Line type="linear" dataKey="value" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-center text-xs text-mute">
        {metric === 'e1rm' ? 'Epley estimate, from sets of 12 reps or fewer.' : metric === 'weight' ? 'Heaviest working set each session.' : 'Weight × reps over all working sets.'}
      </p>
    </div>
  )
}
