import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const IconToday = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
  </svg>
)

export const IconProgress = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 20h18M5 16l5-5 3 3 6-7" />
    <path d="M15 7h4v4" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const IconSwap = (p: P) => (
  <svg {...base} width={16} height={16} {...p}>
    <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </svg>
)

export const IconPrev = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const IconNext = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const IconList = (p: P) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
)

export const IconFocus = (p: P) => (
  <svg {...base} width={18} height={18} {...p}>
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <path d="M8 9h8M8 13h5" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
