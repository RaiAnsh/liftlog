import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { BackBar, Title } from '../components/PageHeader'
import { MUSCLES, MUSCLE_LABELS, type Exercise, type Muscle } from '../types'

function Row({ ex }: { ex: Exercise }) {
  const [primary, setPrimary] = useState<Muscle[]>(ex.primaryMuscles)
  const [secondary, setSecondary] = useState<Muscle[]>(ex.secondaryMuscles)
  const toggle = (list: Muscle[], set: (m: Muscle[]) => void, m: Muscle) =>
    set(list.includes(m) ? list.filter((x) => x !== m) : [...list, m])

  return (
    <div className="card space-y-3">
      <div className="font-medium">{ex.name}</div>
      {([['Primary (1 set each)', primary, setPrimary], ['Secondary (0.5 set each)', secondary, setSecondary]] as const).map(
        ([label, list, set]) => (
          <div key={label}>
            <div className="mb-1 text-sm text-mute">{label}</div>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  onClick={() => toggle(list, set, m)}
                  className={`rounded-full border px-3.5 py-2 text-sm ${list.includes(m) ? 'border-transparent bg-accent text-white' : 'border-line text-mute'}`}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        ),
      )}
      <div className="flex gap-2">
        <button
          className="btn btn-primary flex-1 disabled:opacity-40"
          disabled={primary.length === 0}
          onClick={() => db.exercises.update(ex.id!, { primaryMuscles: primary, secondaryMuscles: secondary, needsReview: false })}
        >
          Save
        </button>
        <button className="btn flex-1" onClick={() => db.exercises.update(ex.id!, { needsReview: false })}>
          No muscles (cardio)
        </button>
      </div>
    </div>
  )
}

export default function TagReview() {
  const list = useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => e.needsReview))
  if (!list) return null
  return (
    <div className="space-y-4">
      <BackBar />
      <Title sub="Coaching counts sets per muscle, so these matter.">Review muscle tags</Title>
      {list.length === 0 && <p className="text-mute">All exercises are tagged.</p>}
      {list.map((e) => <Row key={e.id} ex={e} />)}
    </div>
  )
}
