import type { ExampleTemplate, TemplateItem } from './templates'

const t = (name: string, sets = 3, repMin = 8, repMax = 12, rest = 90): TemplateItem => ({ name, sets, repMin, repMax, rest })
const iso = (name: string, sets = 3) => t(name, sets, 10, 15, 60)

/**
 * Workouts used by the weekly split suggestions (Chest & Back, Shoulders & Arms, glute days, full body, A/B variants,
 * Cardio & Core). They're normal templates once added; "hidden" only means they aren't listed under Example templates.
 */
export const SPLIT_TEMPLATES: ExampleTemplate[] = [
  { id: 'push-b', name: 'Push B', blurb: 'A second push day with different exercises', hidden: true,
    items: [t('Incline Bench Press (Dumbbell)', 3, 8, 12, 120), t('Chest Fly (Cable)', 3, 10, 15, 60), t('Shoulder Press (Dumbbell)'), iso('Lateral Raise (Cable)'), iso('Triceps Pushdown (Rope)'), iso('Overhead Triceps Extension (Cable)')] },
  { id: 'pull-b', name: 'Pull B', blurb: 'A second pull day with different exercises', hidden: true,
    items: [t('Lat Pulldown (Machine)', 3, 8, 12, 120), t('Bent Over One Arm Row (Dumbbell)'), t('Straight Arm Pulldown (Cable)', 3, 10, 15, 60), iso('Reverse Fly (Machine)'), iso('Hammer Curl (Dumbbell)'), iso('Preacher Curl (Machine)')] },
  { id: 'legs-b', name: 'Legs B', blurb: 'A second leg day', hidden: true,
    items: [t('Hack Squat (Machine)', 3, 6, 10, 150), t('Romanian Deadlift (Dumbbell)', 3, 8, 12, 120), t('Walking Lunge (Dumbbell)'), iso('Seated Leg Curl (Machine)'), iso('Standing Calf Raise (Machine)', 4)] },
  { id: 'upper-b', name: 'Upper Body B', blurb: 'A second upper day', hidden: true,
    items: [t('Incline Chest Press (Machine)'), t('Lat Pulldown (Cable)'), iso('Lateral Raise (Dumbbell)'), t('Seated Row (Cable)'), iso('Bicep Curl (Cable)', 2), iso('Triceps Pushdown (Rope)', 2)] },
  { id: 'lower-b', name: 'Lower Body B', blurb: 'A second lower day', hidden: true,
    items: [t('Squat (Smith Machine)', 3, 6, 10, 150), t('Hip Thrust (Machine)', 3, 8, 12, 120), iso('Seated Leg Curl (Machine)'), iso('Leg Extension (Machine)'), iso('Standing Calf Raise (Machine)', 4)] },
  { id: 'chestback', name: 'Chest & Back', blurb: 'Chest and back together', hidden: true,
    items: [t('Chest Press (Machine)', 3, 8, 12, 120), t('Incline Chest Press (Machine)'), iso('Pec Deck (Machine)'), t('Lat Pulldown (Cable)', 3, 8, 12, 120), t('Seated Row (Cable)'), iso('Straight Arm Pulldown (Cable)')] },
  { id: 'shoulders-arms', name: 'Shoulders & Arms', blurb: 'Delts, biceps, triceps', hidden: true,
    items: [t('Shoulder Press (Machine)'), iso('Lateral Raise (Dumbbell)', 4), iso('Reverse Fly (Machine)'), iso('Bicep Curl (Dumbbell)'), iso('Hammer Curl (Dumbbell)', 2), iso('Triceps Pushdown (Rope)'), iso('Overhead Triceps Extension (Cable)', 2)] },
  { id: 'fullbody-a', name: 'Full Body A', blurb: 'Everything in one session', hidden: true,
    items: [t('Leg Press', 3, 8, 12, 120), t('Chest Press (Machine)'), t('Lat Pulldown (Cable)'), t('Shoulder Press (Machine)'), iso('Seated Leg Curl (Machine)', 2), iso('Plank', 2)] },
  { id: 'fullbody-b', name: 'Full Body B', blurb: 'Everything in one session, different exercises', hidden: true,
    items: [t('Squat (Smith Machine)', 3, 6, 10, 150), t('Incline Chest Press (Machine)'), t('Seated Row (Cable)'), iso('Lateral Raise (Dumbbell)'), t('Romanian Deadlift (Dumbbell)', 2, 8, 12, 120), iso('Cable Crunch', 2)] },
  { id: 'glutes-ham', name: 'Glutes & Hamstrings', blurb: 'Hip thrust focus plus hamstrings', hidden: true,
    items: [t('Hip Thrust (Barbell)', 4, 6, 10, 120), t('Romanian Deadlift (Dumbbell)', 3, 8, 12, 120), iso('Seated Leg Curl (Machine)'), iso('Glute Kickback (Cable)'), iso('Hip Abductor (Machine)')] },
  { id: 'quads-glutes', name: 'Quads & Glutes', blurb: 'Squat pattern, lunges and quads', hidden: true,
    items: [t('Squat (Smith Machine)', 3, 6, 10, 150), t('Leg Press', 3, 8, 12, 120), t('Bulgarian Split Squat (Dumbbell)', 3, 8, 12, 90), iso('Leg Extension (Machine)'), iso('Hip Abductor (Machine)'), iso('Standing Calf Raise (Machine)', 4)] },
  { id: 'glute-pump', name: 'Glute Pump & Abs', blurb: 'Higher-rep glute work and core', hidden: true,
    items: [t('Hip Thrust (Machine)', 3, 10, 15, 75), iso('Glute Kickback (Machine)'), iso('Pull Through (Cable)'), iso('Hip Abduction (Cable)'), iso('Cable Crunch'), iso('Plank', 2)] },
  { id: 'hams-calves', name: 'Hamstrings & Calves', blurb: 'Back of the leg and calves', hidden: true,
    items: [iso('Lying Leg Curl (Machine)', 4), t('Romanian Deadlift (Smith Machine)', 3, 8, 12, 120), iso('Seated Calf Raise (Machine)', 4), iso('Standing Calf Raise (Machine)', 3), iso('Back Extension (Machine)')] },
  { id: 'cardio-core', name: 'Cardio & Core', blurb: 'Easy cardio and abs: an active-recovery day', hidden: true,
    items: [t('Incline Walk (Treadmill)', 1, 8, 12, 0), iso('Cable Crunch'), iso('Plank', 3), iso('Hanging Leg Raise')] },
]
