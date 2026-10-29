/**
 * The built-in exercise library: common gym exercises by equipment. Names follow Strong's "Name (Equipment)"
 * style so they merge with an imported history. Muscles come from src/import/exerciseMap.ts, and anything
 * missing here can be created by the lifter (Exercises > New exercise) with their own muscle tags.
 */
const BARBELL = [
  'Squat (Barbell)', 'Front Squat (Barbell)', 'Deadlift (Barbell)', 'Romanian Deadlift (Barbell)', 'Sumo Deadlift (Barbell)', 'Trap Bar Deadlift',
  'Bench Press (Barbell)', 'Incline Bench Press (Barbell)', 'Decline Bench Press (Barbell)', 'Close Grip Bench Press (Barbell)',
  'Overhead Press (Barbell)', 'Strict Military Press (Barbell)', 'Push Press (Barbell)', 'Bent Over Row (Barbell)', 'Pendlay Row (Barbell)', 'T-Bar Row',
  'Upright Row (Barbell)', 'Hip Thrust (Barbell)', 'Glute Bridge (Barbell)', 'Good Morning (Barbell)', 'Lunge (Barbell)', 'Bulgarian Split Squat (Barbell)',
  'Rack Pull (Barbell)', 'Shrug (Barbell)', 'Bicep Curl (Barbell)', 'EZ-Bar Curl', 'Preacher Curl (Barbell)', 'Reverse Curl (Barbell)',
  'Skullcrusher (Barbell)', 'Standing Calf Raise (Barbell)', 'Landmine Press (Barbell)',
]
const DUMBBELL = [
  'Bench Press (Dumbbell)', 'Incline Bench Press (Dumbbell)', 'Decline Bench Press (Dumbbell)', 'Chest Fly (Dumbbell)', 'Incline Fly (Dumbbell)', 'Pullover (Dumbbell)',
  'Shoulder Press (Dumbbell)', 'Arnold Press (Dumbbell)', 'Lateral Raise (Dumbbell)', 'Front Raise (Dumbbell)', 'Rear Delt Fly (Dumbbell)', 'Upright Row (Dumbbell)',
  'Shrug (Dumbbell)', 'Bent Over One Arm Row (Dumbbell)', 'Bent Over Row (Dumbbell)', 'Incline Row (Dumbbell)',
  'Bicep Curl (Dumbbell)', 'Hammer Curl (Dumbbell)', 'Incline Curl (Dumbbell)', 'Concentration Curl (Dumbbell)', 'Zottman Curl (Dumbbell)', 'Preacher Curl (Dumbbell)',
  'Triceps Extension (Dumbbell)', 'Overhead Triceps Extension (Dumbbell)', 'Skullcrusher (Dumbbell)', 'Triceps Kickback (Dumbbell)',
  'Goblet Squat (Dumbbell)', 'Lunge (Dumbbell)', 'Walking Lunge (Dumbbell)', 'Bulgarian Split Squat (Dumbbell)', 'Step Up (Dumbbell)', 'Romanian Deadlift (Dumbbell)',
  'Hip Thrust (Dumbbell)', 'Glute Bridge (Dumbbell)', 'Stiff Leg Deadlift (Dumbbell)', 'Standing Calf Raise (Dumbbell)', 'Wrist Curl (Dumbbell)', 'Farmer’s Walk (Dumbbell)',
]
const MACHINE = [
  'Chest Press (Machine)', 'Incline Chest Press (Machine)', 'Pec Deck (Machine)', 'Chest Fly (Machine)', 'Shoulder Press (Machine)', 'Lateral Raise (Machine)', 'Reverse Fly (Machine)',
  'Lat Pulldown (Machine)', 'Seated Row (Machine)', 'Low Row (Machine)', 'High Row (Machine)', 'Assisted Pull Up', 'Assisted Dip',
  'Leg Press', 'Hack Squat (Machine)', 'Pendulum Squat (Machine)', 'Leg Extension (Machine)', 'Seated Leg Curl (Machine)', 'Lying Leg Curl (Machine)',
  'Hip Abductor (Machine)', 'Hip Adductor (Machine)', 'Hip Thrust (Machine)', 'Glute Kickback (Machine)', 'Glute Drive (Machine)',
  'Seated Calf Raise (Machine)', 'Standing Calf Raise (Machine)', 'Calf Press (Machine)', 'Crunch (Machine)', 'Back Extension (Machine)', 'Torso Rotation (Machine)',
  'Bicep Curl (Machine)', 'Preacher Curl (Machine)', 'Triceps Extension (Machine)', 'Triceps Dip (Machine)', 'Shrug (Machine)',
]
const SMITH = [
  'Squat (Smith Machine)', 'Bench Press (Smith Machine)', 'Incline Bench Press (Smith Machine)', 'Decline Press (Smith Machine)', 'Shoulder Press (Smith Machine)',
  'Bent Over Row (Smith)', 'Upright Row (Smith Machine)', 'Hip Thrust (Smith Machine)', 'Romanian Deadlift (Smith Machine)', 'Lunge (Smith Machine)', 'Split Squat (Smith Machine)',
  'Standing Calf Raise (Smith Machine)', 'Shrug (Smith Machine)',
]
const CABLE = [
  'Chest Fly (Cable)', 'Cable Crossover', 'Low Cable Fly', 'Lat Pulldown (Cable)', 'Close Grip Lat Pulldown (Cable)', 'Straight Arm Pulldown (Cable)', 'Seated Row (Cable)', 'Face Pull (Cable)',
  'Lateral Raise (Cable)', 'Front Raise (Cable)', 'Rear Delt Fly (Cable)', 'Bicep Curl (Cable)', 'Hammer Curl (Cable)', 'Triceps Pushdown (Cable - Straight Bar)', 'Triceps Pushdown (Rope)',
  'Overhead Triceps Extension (Cable)', 'Glute Kickback (Cable)', 'Hip Abduction (Cable)', 'Pull Through (Cable)', 'Cable Crunch', 'Woodchop (Cable)',
]
const BODYWEIGHT = [
  'Pull Up', 'Chin Up', 'Push Up', 'Incline Push Up', 'Triceps Dip', 'Chest Dip', 'Inverted Row', 'Bodyweight Squat', 'Bodyweight Lunge', 'Glute Bridge', 'Single Leg Glute Bridge',
  'Back Extension', 'Reverse Hyperextension', 'Nordic Hamstring Curl', 'Plank', 'Side Plank', 'Crunch', 'Sit Up', 'Bicycle Crunch', 'Russian Twist', 'Hanging Leg Raise', 'Knee Raise (Captain’s Chair)', 'Ab Wheel Rollout',
]
const CARDIO = [
  'Running (Treadmill)', 'Jogging (Treadmill)', 'Walking (Treadmill)', 'Incline Walk (Treadmill)', 'Running (Outdoor)', 'Walking (Outdoor)', 'Hiking',
  'Cycling (Bike)', 'Spin Bike', 'Recumbent Bike', 'Assault Bike', 'Elliptical', 'Arc Trainer', 'Stair Climber', 'Jacob’s Ladder',
  'Rowing (Machine)', 'Ski Erg', 'Jump Rope', 'Swimming', 'Battle Ropes',
]

/** Every built-in exercise, unique, in a stable order. */
export const LIBRARY: string[] = [...new Set([...BARBELL, ...DUMBBELL, ...MACHINE, ...SMITH, ...CABLE, ...BODYWEIGHT, ...CARDIO])]
