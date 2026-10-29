import type { Equipment, Muscle } from '../types'

interface Rule { re: RegExp; primary: Muscle[]; secondary: Muscle[] }
const r = (re: RegExp, primary: Muscle[], secondary: Muscle[] = []): Rule => ({ re, primary, secondary })

/** Ordered: first match wins, so specific patterns come before general ones. Matched against the lowercased name. */
const RULES: Rule[] = [
  r(/\b(running|jogging|hiking|swimming)\b|\bwalking\b(?! lunge)|treadmill|cycling|\bbike\b|elliptical|arc ?trainer|jacob|stair ?(master|climber)|jump rope|battle rope|rowing \((machine|ergometer)\)|rowing machine|ski ?erg/, []),
  r(/rear delt|reverse fly|reverse pec|face pull/, ['rear_delts'], ['upper_back_lats']),
  r(/lateral raise|side raise/, ['side_delts']),
  r(/front raise/, ['front_delts']),
  r(/\btric|skull ?crusher|pushdown|push-down|cross cable extension|close grip bench/, ['triceps']),
  r(/chest dip/, ['chest'], ['triceps', 'front_delts']),
  r(/\bdip\b/, ['triceps'], ['chest', 'front_delts']),
  r(/forearm|wrist|reverse curl|farmer/, ['forearms']),
  r(/free ?hang|dead ?hang/, ['forearms'], ['upper_back_lats']),
  r(/(leg|hamstring) curl/, ['hamstrings']),
  r(/curl|spider|preacher/, ['biceps'], ['forearms']),
  r(/pull ?up|chin ?up|pull-?down|pulldown/, ['upper_back_lats'], ['biceps']),
  r(/upright row/, ['side_delts', 'traps'], ['biceps']),
  r(/pullover|straight.?arm (pull|push)/, ['upper_back_lats'], ['triceps']),
  r(/\brow\b/, ['upper_back_lats'], ['biceps', 'rear_delts']),
  r(/shrug/, ['traps']),
  r(/back extension|hyperextension|good morning/, ['lower_back'], ['glutes', 'hamstrings']),
  r(/romanian|stiff.?leg/, ['hamstrings'], ['glutes', 'lower_back']),
  r(/rack pull|block pull/, ['traps', 'lower_back'], ['glutes', 'hamstrings', 'forearms']),
  r(/deadlift/, ['hamstrings', 'glutes', 'lower_back'], ['traps', 'forearms', 'quads']),
  r(/pull.?through/, ['glutes'], ['hamstrings']),
  r(/hip thrust|glute|bridge|kickback|hip (abduct|adduct)|thigh (abduct|adduct)/, ['glutes'], ['hamstrings']),
  r(/calf|calves/, ['calves']),
  r(/leg extension/, ['quads']),
  r(/squat|leg press|lunge|step.?up/, ['quads'], ['glutes', 'hamstrings']),
  r(/military|shoulder press|overhead press|arnold|push press|landmine press/, ['front_delts'], ['triceps', 'side_delts']),
  r(/pec deck|fly|flye|crossover/, ['chest'], ['front_delts']),
  r(/bench press|chest press|incline (press|chest)|decline press|slipine|supine press|push ?up|\bpress\b.*plates/, ['chest'], ['front_delts', 'triceps']),
  r(/crunch|sit.?up|knee raise|leg raise|torso rotation|russian twist|ab wheel|plank|\babs\b|woodchop/, ['abs']),
]

export interface MuscleGuess { primary: Muscle[]; secondary: Muscle[]; known: boolean }

export function guessMuscles(name: string): MuscleGuess {
  const n = name.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const rule of RULES) {
    if (rule.re.test(n)) return { primary: rule.primary, secondary: rule.secondary, known: true }
  }
  return { primary: [], secondary: [], known: false }
}

export function guessEquipment(name: string): Equipment {
  const n = name.toLowerCase()
  if (/\(barbell|\bbarbell\b|ez.?bar|hip thrust|deadlift/.test(n)) return 'barbell'
  if (/dumbbell/.test(n)) return 'dumbbell'
  if (/cable|pulldown|pull-down/.test(n)) return 'cable'
  if (/machine|smith|leg press|hack squat|pec deck/.test(n)) return 'machine'
  if (/^(pull|chin|push) ?up|\bdip\b|freehang|crunch|knee raise|plank/.test(n)) return 'bodyweight'
  return 'other'
}
