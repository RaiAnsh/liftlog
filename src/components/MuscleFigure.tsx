import type { ReactNode } from 'react'
import type { Muscle } from '../types'

export type View = 'front' | 'back'

/** Muscles drawn in each view (the rest of the body is the grey mannequin). */
export const FRONT_MUSCLES: Muscle[] = ['chest', 'front_delts', 'side_delts', 'traps', 'biceps', 'forearms', 'abs', 'quads', 'calves']
export const BACK_MUSCLES: Muscle[] = ['traps', 'rear_delts', 'side_delts', 'upper_back_lats', 'triceps', 'forearms', 'lower_back', 'glutes', 'hamstrings', 'calves']
const BACK_ONLY = new Set<Muscle>(['rear_delts', 'upper_back_lats', 'triceps', 'lower_back', 'glutes', 'hamstrings'])
/** Which side of the body shows a set of muscles best (back muscles win, since they're hidden from the front). */
export function viewFor(primary: Muscle[]): View {
  const back = primary.filter((m) => BACK_ONLY.has(m)).length
  return back > 0 && back >= primary.length / 2 ? 'back' : primary.includes('traps') && primary.length === 1 ? 'back' : 'front'
}

/** Rough bounding box (x0, y0, x1, y1) of each muscle in the 100 x 200 drawing. */
const BOX: Record<Muscle, [number, number, number, number]> = {
  chest: [30, 42, 70, 60], front_delts: [20, 33, 80, 49], side_delts: [18, 36, 82, 52], rear_delts: [20, 33, 80, 49],
  traps: [34, 26, 66, 60], biceps: [14, 46, 86, 74], triceps: [14, 46, 86, 74], forearms: [8, 78, 92, 114],
  abs: [42, 60, 58, 98], upper_back_lats: [32, 44, 68, 88], lower_back: [41, 85, 59, 102],
  quads: [28, 106, 72, 152], hamstrings: [28, 118, 72, 154], glutes: [33, 100, 67, 120], calves: [28, 156, 72, 190],
}

/** A square viewBox that zooms onto the worked muscles (whole figure if none). */
export function cropBox(muscles: Muscle[]): string {
  if (!muscles.length) return '6 2 88 198'
  const b = muscles.map((m) => BOX[m])
  const x0 = Math.min(...b.map((x) => x[0])), y0 = Math.min(...b.map((x) => x[1]))
  const x1 = Math.max(...b.map((x) => x[2])), y1 = Math.max(...b.map((x) => x[3]))
  const size = Math.max(56, Math.min(198, Math.max(x1 - x0, y1 - y0) + 22))
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const vx = Math.min(Math.max(cx - size / 2, -10), 110 - size)
  const vy = Math.min(Math.max(cy - size / 2, 0), 200 - size)
  return `${vx.toFixed(1)} ${vy.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`
}

type Draw = (fill: string) => ReactNode
const line = (x1: number, y1: number, x2: number, y2: number, w: number): Draw => (f) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={f} strokeWidth={w} strokeLinecap="round" />
const mirror = (d: (flip: boolean) => Draw): Draw => (f) => <>{d(false)(f)}{d(true)(f)}</>
const lr = (x1: number, y1: number, x2: number, y2: number, w: number): Draw => mirror((flip) => line(flip ? 100 - x1 : x1, y1, flip ? 100 - x2 : x2, y2, w))
const circ = (cx: number, cy: number, r: number): Draw => mirror((flip) => (f) => <circle cx={flip ? 100 - cx : cx} cy={cy} r={r} fill={f} />)
const ell = (cx: number, cy: number, rx: number, ry: number): Draw => mirror((flip) => (f) => <ellipse cx={flip ? 100 - cx : cx} cy={cy} rx={rx} ry={ry} fill={f} />)
const poly = (pts: string): Draw => (f) => <polygon points={pts} fill={f} strokeLinejoin="round" stroke={f} strokeWidth="2" />
const polyLR = (pts: [number, number][]): Draw => (f) => (
  <>
    <polygon points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill={f} stroke={f} strokeWidth="2" strokeLinejoin="round" />
    <polygon points={pts.map(([x, y]) => `${100 - x},${y}`).join(' ')} fill={f} stroke={f} strokeWidth="2" strokeLinejoin="round" />
  </>
)

const FRONT: Partial<Record<Muscle, Draw>> = {
  traps: poly('44,27 56,27 66,36 34,36'),
  chest: ell(40.5, 51, 9.8, 8.5),
  front_delts: circ(30, 41, 8),
  side_delts: ell(23.5, 44, 5.5, 9),
  biceps: lr(23, 50, 20.5, 70, 8.5),
  forearms: lr(18, 81, 15, 108, 6),
  abs: (f) => <rect x="43.5" y="62" width="13" height="34" rx="4" fill={f} />,
  quads: lr(41, 114, 39.5, 148, 13),
  calves: lr(39, 160, 38, 186, 8),
}
const BACK: Partial<Record<Muscle, Draw>> = {
  traps: poly('50,26 62,34 50,60 38,34'),
  rear_delts: circ(30, 41, 8),
  side_delts: ell(23.5, 44, 5.5, 9),
  upper_back_lats: polyLR([[35, 46], [47, 58], [45, 86], [38, 84]]),
  triceps: lr(23, 50, 20.5, 70, 8.5),
  forearms: lr(18, 81, 15, 108, 6),
  lower_back: (f) => <rect x="43" y="87" width="14" height="14" rx="4" fill={f} />,
  glutes: circ(43.5, 111, 8.5),
  hamstrings: lr(41, 124, 39.5, 150, 13),
  calves: lr(39, 160, 38, 186, 9),
}

/** The grey mannequin that muscles are painted on. */
function Body({ fill }: { fill: string }) {
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number) => (
    <>{[false, true].map((flip) => <line key={String(flip)} x1={flip ? 100 - x1 : x1} y1={y1} x2={flip ? 100 - x2 : x2} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />)}</>
  )
  return (
    <g>
      <circle cx="50" cy="13" r="9" fill={fill} />
      <rect x="46" y="20" width="8" height="10" rx="3" fill={fill} />
      <path d="M30 33 Q50 27 70 33 L68 60 Q66 84 62 100 L38 100 Q34 84 32 60 Z" fill={fill} />
      <rect x="37" y="97" width="26" height="18" rx="8" fill={fill} />
      {limb(25, 39, 19, 76, 11)}
      {limb(19, 79, 15, 112, 9)}
      {[false, true].map((flip) => <circle key={String(flip)} cx={flip ? 86 : 14} cy="117" r="4.5" fill={fill} />)}
      {limb(41, 108, 39, 152, 16)}
      {limb(39, 155, 38, 190, 11)}
      {[false, true].map((flip) => <ellipse key={String(flip)} cx={flip ? 62 : 38} cy="195" rx="7" ry="3.5" fill={fill} />)}
    </g>
  )
}

const ACCENT = 'rgb(var(--accent))'
const BASE = 'rgb(var(--mute) / 0.32)'

/**
 * A body figure with muscles painted on it. `primary` is bright, `secondary` is dimmer.
 * `colors` paints specific muscles (used for the weekly muscle map); `crop` zooms to the relevant half.
 */
export default function MuscleFigure({ view, primary = [], secondary = [], colors, crop = false, className, title }: {
  view: View; primary?: Muscle[]; secondary?: Muscle[]; colors?: Partial<Record<Muscle, string>>; crop?: boolean; className?: string; title?: string
}) {
  const shapes = view === 'front' ? FRONT : BACK
  const list = view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES
  const fillFor = (m: Muscle): string | null => colors?.[m] ?? (primary.includes(m) ? ACCENT : secondary.includes(m) ? 'rgb(var(--accent) / 0.45)' : null)
  return (
    <svg viewBox={crop ? cropBox(primary.length ? primary : secondary) : '6 2 88 198'} className={className} role="img" aria-label={title ?? `${view} view`} preserveAspectRatio="xMidYMid meet">
      <Body fill={BASE} />
      {list.map((m) => {
        const f = fillFor(m)
        const draw = shapes[m]
        return f && draw ? <g key={m} className="fig-muscle">{draw(f)}</g> : null
      })}
    </svg>
  )
}
