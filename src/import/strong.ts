import Papa from 'papaparse'
import type { SetType } from '../types'

export interface ParsedSet {
  exerciseName: string
  setOrderRaw: string
  type: SetType
  /** weight exactly as in the file (unit chosen by the user at import time) */
  weight: number
  reps: number
  distance: number
  seconds: number
  rpe: number | null
  notes: string
  order: number
  importKey: string
}

export interface ParsedWorkout {
  importKey: string
  dateStr: string
  startedAt: number
  name: string
  durationMin: number | null
  notes: string
  sets: ParsedSet[]
}

export interface SkippedRow { row: number; reason: string }

export interface ParseResult {
  workouts: ParsedWorkout[]
  skipped: SkippedRow[]
  warnings: string[]
  delimiter: string
  rowCount: number
}

/** Durations above this are treated as an app left running (Strong exports e.g. "167h 45min"). */
export const MAX_PLAUSIBLE_MINUTES = 12 * 60

export function parseDuration(raw: string): number | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return null
  const clock = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  let minutes = 0
  let matched = false
  const h = t.match(/(\d+(?:\.\d+)?)\s*h/)
  if (h) { minutes += Number(h[1]) * 60; matched = true }
  const m = t.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/)
  if (m) { minutes += Number(m[1]); matched = true }
  const s = t.match(/(\d+(?:\.\d+)?)\s*s(?:ec)?\b/)
  if (s) { minutes += Number(s[1]) / 60; matched = true }
  return matched ? Math.round(minutes) : null
}

/** "2022-06-19 15:41:43" (or ISO "T" form) as local time. */
export function parseLocalDate(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  const t = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime()
  return Number.isNaN(t) ? null : t
}

const num = (v: string | undefined): number => {
  const n = parseFloat((v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Header lookup tolerant of case/whitespace. */
export function field(row: Record<string, string>, name: string): string {
  const target = name.toLowerCase()
  for (const k of Object.keys(row)) if (k.trim().toLowerCase() === target) return row[k] ?? ''
  return ''
}

export function parseCsv(text: string) {
  const clean = text.replace(/^﻿/, '')
  const res = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t'],
    transformHeader: (h) => h.trim(),
  })
  return { rows: res.data, delimiter: res.meta.delimiter, errors: res.errors }
}

function classifyMarker(raw: string): { type: SetType; known: boolean } | 'rest' {
  const t = raw.trim()
  if (/^\d+$/.test(t)) return { type: 'working', known: true }
  switch (t.toLowerCase()) {
    case 'w': return { type: 'warmup', known: true }
    case 'd': return { type: 'drop', known: true }
    case 'f': return { type: 'failure', known: true }
    case 'rest timer': return 'rest'
  }
  return { type: 'working', known: false }
}

export function parseStrongWorkouts(text: string): ParseResult {
  const { rows, delimiter, errors } = parseCsv(text)
  const skipped: SkippedRow[] = []
  const warnings: string[] = []
  const unknownMarkers = new Map<string, number>()
  const byKey = new Map<string, ParsedWorkout>()
  const occurrences = new Map<string, number>()
  let longDurations = 0

  for (const e of errors) if (e.row !== undefined) warnings.push(`CSV parse issue near row ${e.row + 2}: ${e.message}`)

  rows.forEach((row, i) => {
    const rowNo = i + 2
    const dateStr = field(row, 'Date').trim()
    const name = field(row, 'Workout Name').trim()
    const exerciseName = field(row, 'Exercise Name').trim()
    const marker = field(row, 'Set Order')

    const startedAt = parseLocalDate(dateStr)
    if (startedAt === null) return void skipped.push({ row: rowNo, reason: `Unreadable date "${dateStr}"` })
    if (!exerciseName) return void skipped.push({ row: rowNo, reason: 'Missing exercise name' })

    const kind = classifyMarker(marker)
    if (kind === 'rest') return void skipped.push({ row: rowNo, reason: 'Rest Timer entry (not a set)' })
    if (!kind.known) unknownMarkers.set(marker, (unknownMarkers.get(marker) ?? 0) + 1)

    const weight = num(field(row, 'Weight'))
    const reps = num(field(row, 'Reps'))
    const seconds = num(field(row, 'Seconds'))
    const distance = num(field(row, 'Distance'))
    if (weight === 0 && reps === 0 && seconds === 0 && distance === 0) {
      return void skipped.push({ row: rowNo, reason: 'Empty set (no weight, reps, time or distance)' })
    }

    const wkKey = `${dateStr}|${name}`
    let w = byKey.get(wkKey)
    if (!w) {
      let durationMin = parseDuration(field(row, 'Duration'))
      if (durationMin !== null && durationMin > MAX_PLAUSIBLE_MINUTES) {
        longDurations++
        durationMin = null
      }
      w = {
        importKey: wkKey, dateStr, startedAt, name: name || 'Workout', durationMin,
        notes: field(row, 'Workout Notes').trim(), sets: [],
      }
      byKey.set(wkKey, w)
    }

    // Same exercise can appear twice in one workout, so disambiguate repeats by occurrence.
    const base = `${wkKey}|${exerciseName.toLowerCase()}|${marker.trim()}`
    const occ = occurrences.get(base) ?? 0
    occurrences.set(base, occ + 1)

    const rpeRaw = field(row, 'RPE').trim()
    w.sets.push({
      exerciseName, setOrderRaw: marker.trim(), type: kind.type, weight, reps, distance, seconds,
      rpe: rpeRaw && Number.isFinite(parseFloat(rpeRaw)) ? parseFloat(rpeRaw) : null,
      notes: field(row, 'Notes').trim(),
      order: w.sets.length,
      importKey: `${base}|${occ}`,
    })
  })

  for (const [m, n] of unknownMarkers) warnings.push(`Unknown set marker "${m}" on ${n} row(s); treated as a working set.`)
  if (longDurations) warnings.push(`${longDurations} workout(s) had an implausible duration (over 12h) and were saved without an end time.`)

  return { workouts: [...byKey.values()], skipped, warnings, delimiter, rowCount: rows.length }
}
