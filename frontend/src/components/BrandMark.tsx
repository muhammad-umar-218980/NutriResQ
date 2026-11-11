interface BrandMarkProps {
  size?: number
  tone?: 'nav' | 'footer'
}

/**
 * The NutriResQ mark: a rust rescue arc, an olive leaf and a beige vein.
 * Same geometry as the landing page and the favicon.
 */
export default function BrandMark({ size = 30, tone = 'nav' }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M33.5 12.5A16 16 0 1 0 36 21"
        fill="none"
        stroke="#B85C38"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M12 27c0-9 6-14 16-14 0 9-5 15-14 15z" fill={tone === 'nav' ? '#626B45' : '#858C65'} />
      <path
        d="M13 27c4-5 8-8 13-11"
        fill="none"
        stroke={tone === 'nav' ? '#F3EBDD' : '#414A30'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
