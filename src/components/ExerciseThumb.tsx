import { useState } from 'react'
import { imageUrl } from '../data/images'
import { MUSCLE_LABELS, type Muscle } from '../types'

const HUES: Record<string, number> = {
  chest: 8, front_delts: 28, side_delts: 38, rear_delts: 48, upper_back_lats: 210, traps: 225, biceps: 150,
  triceps: 170, forearms: 190, abs: 280, quads: 330, hamstrings: 345, glutes: 310, calves: 255, lower_back: 240,
}

/** Rounded exercise image (start frame); falls back to a muscle-coloured initial tile. */
export default function ExerciseThumb({ name, muscle, size = 48 }: { name: string; muscle?: Muscle; size?: number }) {
  const [failed, setFailed] = useState(false)
  const url = imageUrl(name, 0)
  const style = { width: size, height: size, minWidth: size }
  if (url && !failed) {
    return (
      <img
        src={url} alt="" loading="lazy" onError={() => setFailed(true)} style={style}
        className="rounded-xl bg-card2 object-cover"
      />
    )
  }
  const hue = muscle ? HUES[muscle] : 220
  return (
    <div
      style={{ ...style, background: `hsl(${hue} 45% 28%)`, color: `hsl(${hue} 70% 85%)` }}
      className="flex items-center justify-center rounded-xl text-lg font-bold"
      title={muscle ? MUSCLE_LABELS[muscle] : undefined}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
