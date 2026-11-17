import { useEffect, useState } from 'react'

/**
 * Shared bits for the Recharts figures.
 *
 * Every chart is a supporting visual: the tables below each one stay the
 * accessible, exact-value source, so the figures only need a short text
 * alternative and a reduced-motion off-switch.
 */

export const CHART_COLOURS = {
  /** ACO / variant / "ours" series. */
  primary: '#2f7d32',
  /** Nearest neighbour / base series. */
  secondary: '#98482d',
  /** Third series, matching the desk palette. */
  tertiary: '#414a30',
  /** Baseline series keeps a muted tone. */
  muted: '#a39d8c',
  grid: '#e4e0d4',
  axis: '#c9c4b4',
} as const

/** Reads `prefers-reduced-motion` and keeps listening for changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

/** Compact number for axis ticks and tooltips. */
export function chartNumber(value: number, digits = 2): string {
  const factor = 10 ** digits
  return String(Math.round(value * factor) / factor)
}
