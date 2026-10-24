import { Link } from 'react-router-dom'
import ExerciseBrowser from '../components/ExerciseBrowser'
import ExerciseThumb from '../components/ExerciseThumb'
import { ChevronRight } from '../components/Icons'
import { Title } from '../components/PageHeader'
import { useExerciseItems } from '../lib/useExerciseItems'
import { guessMuscles } from '../import/exerciseMap'
import { MUSCLE_LABELS } from '../types'

export default function Exercises() {
  const items = useExerciseItems()
  return (
    <div>
      <Title sub="Includes Planet Fitness machines">Exercises</Title>
      <ExerciseBrowser items={items} stickyTop="env(safe-area-inset-top)" renderRow={(i) => (
        <Link to={`/exercise/${encodeURIComponent(i.key)}`} className="row-press flex items-center gap-3 px-3 py-2.5">
          <ExerciseThumb name={i.name} muscles={i.muscles} secondary={guessMuscles(i.name).secondary} size={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{i.name}</div>
            <div className="truncate text-sm text-mute">
              {i.muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || 'No muscles tagged'}
              {i.mine ? (i.sets ? ` · ${i.sets} sets logged` : '') : ' · not added yet'}
            </div>
          </div>
          {i.pf && <span className="rounded-md bg-[#5b2a86]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#c9a2ff]">PF</span>}
          <span className="text-mute"><ChevronRight /></span>
        </Link>
      )} />
    </div>
  )
}
