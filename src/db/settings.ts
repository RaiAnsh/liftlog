import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LiftLogDB } from './db'
import { DEFAULT_SETTINGS, type Settings } from '../types'

export async function getSettings(d: LiftLogDB = db): Promise<Settings> {
  const rows = await d.settings.toArray()
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) out[r.key] = r.value
  return out as unknown as Settings
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K], d: LiftLogDB = db) {
  await d.settings.put({ key, value })
}

/** False until the saved settings have actually loaded (useSettings returns defaults until then). */
export function useSettingsReady(): boolean {
  return useLiveQuery(async () => { await getSettings(); return true }, [], false)
}

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
}
