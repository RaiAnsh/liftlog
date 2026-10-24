import { guessMuscles } from '../import/exerciseMap'
import type { Muscle } from '../types'
import MuscleFigure, { viewFor } from './MuscleFigure'

/**
 * Strong-style exercise thumbnail: a body figure with the worked muscles lit up, instead of a photo.
 * Pass the exercise's real muscle tags when you have them; otherwise they're guessed from the name.
 */
export default function ExerciseThumb({ name, muscle, muscles, secondary, size = 48 }: {
  name: string; muscle?: Muscle; muscles?: Muscle[]; secondary?: Muscle[]; size?: number
}) {
  const guess = muscles || muscle ? null : guessMuscles(name)
  const primary = muscles ?? (muscle ? [muscle] : guess!.primary)
  const sec = secondary ?? guess?.secondary ?? []
  return (
    <div className="shrink-0 overflow-hidden rounded-xl bg-card2" style={{ width: size, height: size }} aria-hidden>
      <MuscleFigure view={viewFor(primary)} primary={primary} secondary={sec} crop className="h-full w-full" />
    </div>
  )
}
