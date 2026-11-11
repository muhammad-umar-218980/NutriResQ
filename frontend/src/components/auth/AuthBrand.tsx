import { Link } from 'react-router-dom'

/**
 * Brand mark reused from the landing page. It is duplicated rather than shared
 * so the finalized HomePage stays untouched.
 */
export default function AuthBrand() {
  return (
    <Link className="auth-brand" to="/" aria-label="NutriResQ home">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M33.5 12.5A16 16 0 1 0 36 21"
          fill="none"
          stroke="#B85C38"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M12 27c0-9 6-14 16-14 0 9-5 15-14 15z" fill="#626B45" />
        <path
          d="M13 27c4-5 8-8 13-11"
          fill="none"
          stroke="#F3EBDD"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="auth-brand__word">
        Nutri<span>ResQ</span>
      </span>
    </Link>
  )
}
