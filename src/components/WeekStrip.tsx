import type { weekStrip } from '../coaching/plan'

type Day = ReturnType<typeof weekStrip>[number]

/** Your week at a glance: the planned workout for each day, ticked when done, 😢 when skipped, today highlighted. */
export default function WeekStrip({ days, onEdit }: { days: Day[]; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="rise press card w-full text-left" aria-label="Edit your weekly plan">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Your week</span>
        <span className="text-xs font-semibold text-accent">Edit plan</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div key={d.day} className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-2 ${d.today ? 'bg-accent/15 ring-2 ring-accent' : 'bg-card2'}`}>
            <span className={`text-[11px] font-bold ${d.today ? 'text-accent' : 'text-mute'}`}>{d.label.slice(0, 2)}</span>
            <span className="flex h-6 items-center text-lg" aria-hidden>
              {d.done ? <span className="pop text-good">✓</span> : d.skipped ? '😢' : d.routine ? <span className="h-2.5 w-2.5 rounded-full bg-accent/60" /> : <span className="text-mute/50">·</span>}
            </span>
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-none text-mute">{d.routine ? d.routine.name.slice(0, 5) : 'Rest'}</span>
          </div>
        ))}
      </div>
    </button>
  )
}
