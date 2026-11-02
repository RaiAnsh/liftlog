export const MUSCLES = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'upper_back_lats', 'traps', 'biceps',
  'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'lower_back',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest', front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts',
  upper_back_lats: 'Upper back / lats', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', lower_back: 'Lower back',
}

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other'
export type Unit = 'lb' | 'kg'
export type SetType = 'warmup' | 'working' | 'drop' | 'failure'

export interface Exercise {
  id?: number
  name: string
  /** lowercase trimmed name, unique */
  nameKey: string
  equipment: Equipment
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  /** kg */
  weightIncrement: number
  repRangeMin: number
  repRangeMax: number
  isCustom: boolean
  archived: boolean
  /** true when muscles are unassigned and the user still has to tag them */
  needsReview: boolean
  /** time/distance exercise (treadmill, bike...) instead of weight x reps. Absent on older rows: see isCardio() */
  cardio?: boolean
}

export interface RoutineItem {
  exerciseId: number
  targetSets: number
  repRangeMin: number
  repRangeMax: number
  restSeconds: number
  notes: string
}

export interface Routine {
  id?: number
  name: string
  items: RoutineItem[]
  order: number
}

export interface Workout {
  id?: number
  routineId: number | null
  name: string
  /** epoch ms */
  startedAt: number
  /** epoch ms; null when unknown (e.g. implausible imported duration) */
  endedAt: number | null
  notes: string
  source: 'strong-import' | 'app'
  /** dedupe key for imports: "<date string>|<workout name>" */
  importKey?: string
}

export interface WorkoutSet {
  id?: number
  workoutId: number
  exerciseId: number
  order: number
  type: SetType
  weightKg: number
  reps: number
  rpe: number | null
  distance: number
  seconds: number
  notes: string
  completed: boolean
  /** shared number marks exercises done as a superset */
  supersetGroup?: number | null
  importKey?: string
}

export interface Settings {
  units: Unit
  theme: 'dark' | 'light'
  weekStartDay: 0 | 1
  defaultRestSeconds: number
  weeklyTargets: Partial<Record<Muscle, { min: number; max: number }>>
  /** empty bar weight per unit */
  barWeight: Record<Unit, number>
  /** plates you have available (per side, as many as needed) */
  plates: Record<Unit, number[]>
  lastBackupAt: number | null
  /** first time the app was opened, so the backup reminder has something to count from */
  installedAt: number | null
  /** routine ids in your rotation; empty means every routine, in routine order */
  program: number[]
  /** workouts you chose to skip, newest last */
  skipLog: SkipEntry[]
  /** main training goal; sets how many weekly sets each muscle gets. null until you pick one */
  goal: { id: GoalId; tiers: Record<Muscle, Tier> } | null
  goalAsked: boolean
  /** your answer to "use this workout as a template?", by normalised workout name. Declined ones are never offered again */
  templateChoices: Record<string, 'added' | 'declined'>
  phase: Phase
  volumeStyle: VolumeStyle
  /** the top of your usual rep range (default 12); used for new and inferred templates */
  repCeiling: number
  /** your week: routine id per weekday, 0 = Sunday ... 6 = Saturday (null = rest). null until you plan one */
  plan: (number | null)[] | null
  planDays: number[]
  coachState: CoachState
}

export type Tier = 'priority' | 'standard' | 'light'
/** Where you are with your body-weight goal. Cutting changes what "progress" and "coaching" mean. */
export type Phase = 'build' | 'maintain' | 'cut'
/** How many hard sets per muscle per week you realistically train. */
export type VolumeStyle = 'efficient' | 'standard' | 'high'
export type GoalId = 'vtaper' | 'glutes' | 'balanced' | 'custom'

export interface SkipEntry {
  id: string
  /** epoch ms */
  at: number
  routineId: number | null
  name: string
  reason: string | null
}

export interface CoachState {
  /** exerciseId -> when a deload was chosen; cleared once that lift is trained again */
  deload: Record<number, number>
  /** exerciseId -> number of sessions when the plateau card was dismissed */
  dismissed: Record<number, number>
  /** coach suggestion id -> when you applied it, so it isn't shown again right away */
  applied?: Record<string, number>
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'lb',
  theme: 'dark',
  weekStartDay: 1,
  defaultRestSeconds: 120,
  weeklyTargets: {},
  barWeight: { lb: 45, kg: 20 },
  plates: { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lastBackupAt: null,
  installedAt: null,
  program: [],
  skipLog: [],
  goal: null,
  goalAsked: false,
  templateChoices: {},
  phase: 'build',
  volumeStyle: 'standard',
  repCeiling: 12,
  plan: null,
  planDays: [],
  coachState: { deload: {}, dismissed: {} },
}

/** A set while a workout is in progress. Weight is kg, null until entered. */
export interface DraftSet {
  uid: string
  type: SetType
  weightKg: number | null
  reps: number | null
  rpe: number | null
  completed: boolean
  /** cardio only: duration in seconds and distance in km */
  seconds?: number | null
  distanceKm?: number | null
  /** when it was completed (epoch ms), used for momentum streaks */
  doneAt?: number
  /** met its target (or the bottom of the rep range when there is no target) */
  hit?: boolean
}

export interface DraftExercise {
  uid: string
  exerciseId: number
  restSeconds: number
  notes: string
  showRpe: boolean
  /** exercises sharing the same number are a superset */
  superset: number | null
  repMin: number | null
  repMax: number | null
  cardio?: boolean
  sets: DraftSet[]
}

export interface RestTimer {
  /** epoch ms; the countdown is derived from this so it survives screen lock and reloads */
  endsAt: number
  total: number
  label: string
  alerted: boolean
}

/** The single workout in progress, persisted in IndexedDB so it survives closing the app. */
export interface ActiveWorkout {
  key: 'current'
  name: string
  routineId: number | null
  startedAt: number
  notes: string
  exercises: DraftExercise[]
  rest: RestTimer | null
}
