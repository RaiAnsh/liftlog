import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ExerciseFormSheet from '../components/ExerciseFormSheet'
import ExerciseBrowser from '../components/ExerciseBrowser'
import ExerciseThumb from '../components/ExerciseThumb'
import { ChevronRight } from '../components/Icons'
import { Title } from '../components/PageHeader'
import { useExerciseItems } from '../lib/useExerciseItems'
import { guessMuscles } from '../import/exerciseMap'
import { MUSCLE_LABELS } from '../types'

export default function Exercises() {
  const items = useExerciseItems()
  const nav = useNavigate()
  const [creating, setCreating] = useState<string | null>(null)
  return (
    <div>
      <Title sub="Machines, cables and free weights">Exercises</Title>
      <ExerciseBrowser items={items} stickyTop="env(safe-area-inset-top)" onCreate={(n) => setCreating(n)} renderRow={(i) => (
        <Link to={`/exercise/${encodeURIComponent(i.key)}`} className="row-press flex items-center gap-3 px-3 py-2.5">
          <ExerciseThumb name={i.name} muscles={i.muscles} secondary={guessMuscles(i.name).secondary} size={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{i.name}</div>
            <div className="truncate text-sm text-mute">
              {i.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || 'No muscles tagged'}
              {i.mine ? (i.sets ? ` · ${i.sets} sets logged` : '') : ' · not added yet'}
            </div>
          </div>
          <span className="text-mute"><ChevronRight /></span>
        </Link>
      )} />
      {creating !== null && <ExerciseFormSheet initialName={creating} onClose={() => setCreating(null)} onSaved={(ex) => { setCreating(null); nav(`/exercise/${encodeURIComponent(ex.nameKey)}`) }} />}
    </div>
  )
}
