import instructions from './instructions.json'
import { IMAGE_IDS } from './exerciseImages'

export { PLANET_FITNESS_LIBRARY } from './exerciseImages'

const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

export function imageId(name: string): string | null {
  return IMAGE_IDS[norm(name)] ?? null
}

/** Frame 0 is the start position, frame 1 the end position. */
export function imageUrl(name: string, frame: 0 | 1 = 0): string | null {
  const id = imageId(name)
  return id ? `${import.meta.env.BASE_URL}exercises/${id}/${frame}.jpg` : null
}

export function instructionsFor(name: string): string[] {
  const id = imageId(name)
  return id ? ((instructions as Record<string, string[]>)[id] ?? []) : []
}
