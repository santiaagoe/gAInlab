import { bestE1rm } from './progression'
import type { Session } from './types'

/**
 * Overall progress across all exercises. Each exercise is compared with its own first session,
 * so a squat at 80 kg and a curl at 10 kg weigh the same: the index is the average of those ratios, 100 = start.
 * Bodyweight sets without extra load have no strength estimate and are left out.
 */

/** Below this change an exercise counts as held, not as up or down: a rep more or less is noise. */
export const FLAT_BAND = 0.02

export interface IndexPoint {
  /** Monday of the week, local time. */
  week: Date
  /** 100 = where each exercise started. */
  index: number
  /** Exercises that were part of the average that week. */
  exercises: number
}

export interface ExerciseChange {
  exerciseId: string
  /** 0.12 = +12% of estimated strength from the first to the last session. */
  change: number
  sessions: number
}

export interface OverallProgress {
  points: IndexPoint[]
  /** Exercises with at least two sessions, best first. */
  changes: ExerciseChange[]
  up: number
  flat: number
  down: number
}

interface Entry {
  time: number
  e1rm: number
}

function mondayOf(time: number): Date {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** Per exercise, the strength estimate of every session with load, oldest first. */
function entriesByExercise(sessions: Session[]): Map<string, Entry[]> {
  const out = new Map<string, Entry[]>()
  for (const s of sessions) {
    const time = new Date(s.date).getTime()
    if (Number.isNaN(time)) continue
    for (const log of s.exercises) {
      const e1rm = bestE1rm(log)
      if (e1rm <= 0) continue
      const list = out.get(log.exerciseId) ?? []
      list.push({ time, e1rm })
      out.set(log.exerciseId, list)
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.time - b.time)
  return out
}

export function overallProgress(sessions: Session[]): OverallProgress {
  const byExercise = entriesByExercise(sessions)

  // One point per week with training, using each exercise's latest session up to the end of that week.
  const weeks = [...new Set([...byExercise.values()].flat().map((e) => mondayOf(e.time).getTime()))].sort((a, b) => a - b)
  const points: IndexPoint[] = []
  for (const week of weeks) {
    const end = new Date(week)
    end.setDate(end.getDate() + 7)
    const ratios: number[] = []
    for (const list of byExercise.values()) {
      const upTo = list.filter((e) => e.time < end.getTime())
      if (upTo.length === 0) continue
      ratios.push(upTo[upTo.length - 1].e1rm / list[0].e1rm)
    }
    if (ratios.length === 0) continue
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
    points.push({ week: new Date(week), index: Math.round(avg * 1000) / 10, exercises: ratios.length })
  }

  const changes: ExerciseChange[] = [...byExercise.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([exerciseId, list]) => ({
      exerciseId,
      change: list[list.length - 1].e1rm / list[0].e1rm - 1,
      sessions: list.length,
    }))
    .sort((a, b) => b.change - a.change)

  return {
    points,
    changes,
    up: changes.filter((c) => c.change > FLAT_BAND).length,
    flat: changes.filter((c) => Math.abs(c.change) <= FLAT_BAND).length,
    down: changes.filter((c) => c.change < -FLAT_BAND).length,
  }
}
