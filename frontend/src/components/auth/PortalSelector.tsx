import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { PORTAL_ORDER, PORTALS } from '../../config/auth-portals'
import type { PortalId } from '../../types/auth'

interface PortalSelectorProps {
  value: PortalId
  onChange: (portal: PortalId) => void
}

const TRACK_PADDING = 4

/**
 * Single continuous segmented control. The rust indicator is positioned from
 * the measured active button so it stays aligned after font loading and
 * window resizing.
 */
export default function PortalSelector({ value, onChange }: PortalSelectorProps) {
  const groupRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])

  const positionIndicator = useCallback(() => {
    const group = groupRef.current
    const indicator = indicatorRef.current
    const active = buttonsRef.current.find(
      (button) => button?.dataset.portal === value,
    )

    if (!group || !indicator || !active) return

    const groupRect = group.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const offset = group.clientLeft + TRACK_PADDING

    indicator.style.width = `${activeRect.width}px`
    indicator.style.transform = `translateX(${
      activeRect.left - groupRect.left - offset
    }px)`
  }, [value])

  useLayoutEffect(() => {
    positionIndicator()
  }, [positionIndicator])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    const observer = new ResizeObserver(positionIndicator)
    observer.observe(group)
    for (const button of buttonsRef.current) {
      if (button) observer.observe(button)
    }

    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) positionIndicator()
    })

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [positionIndicator])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const { key } = event
    const lastIndex = PORTAL_ORDER.length - 1
    let nextIndex: number

    if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = index === lastIndex ? 0 : index + 1
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = index === 0 ? lastIndex : index - 1
    } else if (key === 'Home') {
      nextIndex = 0
    } else if (key === 'End') {
      nextIndex = lastIndex
    } else {
      return
    }

    event.preventDefault()
    onChange(PORTAL_ORDER[nextIndex])
    buttonsRef.current[nextIndex]?.focus()
  }

  return (
    <div
      className="portal-selector"
      role="radiogroup"
      aria-label="Choose your portal"
      ref={groupRef}
    >
      {PORTAL_ORDER.map((portal, index) => (
        <button
          key={portal}
          ref={(node) => {
            buttonsRef.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={value === portal}
          tabIndex={value === portal ? 0 : -1}
          className="portal-option"
          data-portal={portal}
          onClick={() => onChange(portal)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {PORTALS[portal].label}
        </button>
      ))}
      <span className="portal-indicator" ref={indicatorRef} aria-hidden="true" />
    </div>
  )
}
