import { useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import './HomePage.css'

import heroImage from '../assets/landing/hero-produce.jpg'
import problemImage from '../assets/landing/problem-market.jpg'
import collectImage from '../assets/landing/step-collect-bakery.jpg'
import matchImage from '../assets/landing/step-match-packages.jpg'
import deliverImage from '../assets/landing/step-deliver-volunteers.jpg'
import impactImage from '../assets/landing/impact-vegetables.jpg'

const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'problem', label: 'The Problem' },
  { id: 'solution', label: 'Our Solution' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'impact', label: 'Our Impact' },
]

const PROBLEM_ITEMS = [
  {
    title: 'Food Waste',
    body: 'Surplus food often goes unused because donors and recipients are not efficiently connected.',
  },
  {
    title: 'Fragmented Coordination',
    body: 'Donations, recipient needs and delivery operations can become difficult to coordinate across disconnected channels.',
  },
  {
    title: 'Limited Resources',
    body: 'Vehicle capacities, fleet availability and transportation constraints make redistribution challenging.',
  },
  {
    title: 'Inefficient Deliveries',
    body: 'Poor delivery planning and changing road conditions can waste valuable time and resources.',
  },
]

const PILLARS = [
  {
    title: 'Connected Food Network',
    body: 'Bring food donors and recipient organizations into one coordinated ecosystem.',
  },
  {
    title: 'Intelligent Food Matching',
    body: 'Match available donations with recipient demand, food preferences, urgency and eligibility.',
  },
  {
    title: 'Optimized Delivery Planning',
    body: 'Coordinate vehicle capacities, collection points, delivery destinations and efficient road routes.',
  },
  {
    title: 'Adaptive Operations',
    body: 'Review and update redistribution plans when food availability, recipient demand, fleet availability or road conditions change.',
  },
]

const IMPACT_ITEMS = [
  {
    title: 'Reduce Food Waste',
    body: 'Help surplus food reach useful destinations instead of going unused.',
  },
  {
    title: 'Support Communities',
    body: 'Connect available food with organizations serving people in need.',
  },
  {
    title: 'Use Resources Efficiently',
    body: 'Reduce unnecessary travel and improve transportation utilization.',
  },
  {
    title: 'Build Stronger Networks',
    body: 'Bring donors, recipients and delivery partners into one connected ecosystem.',
  },
]

const ROLES = [
  {
    title: 'Food Donors',
    body: 'Restaurants, bakeries, supermarkets and food businesses looking to give surplus food a meaningful destination.',
    cta: 'Join as a Donor',
    href: '/register?role=donor',
  },
  {
    title: 'Recipient Organizations',
    body: 'Welfare centers, shelters and community kitchens looking to connect with available food donations.',
    cta: 'Join as a Recipient',
    href: '/register?role=recipient',
  },
  {
    title: 'Fleet Partners',
    body: 'Delivery providers and fleet operators who want to support coordinated food redistribution.',
    cta: 'Join as a Fleet Partner',
    href: '/register?role=fleet',
  },
]

function BrandMark({ tone = 'nav' }: { tone?: 'nav' | 'footer' }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
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

function UiMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M33.5 12.5A16 16 0 1 0 36 21"
        fill="none"
        stroke="#EAE0CD"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M12 27c0-9 6-14 16-14 0 9-5 15-14 15z" fill="#FAF7F0" />
    </svg>
  )
}

function ImageCaptionFallback(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.closest('.media')?.classList.add('is-missing')
}

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8)
  const [activeSection, setActiveSection] = useState('home')

  // Sticky navigation border.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  // Mobile menu: Escape closes it and its listeners only exist while open.
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth >= 960) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [menuOpen])

  // Scroll-spy for the primary navigation.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    NAV_LINKS.forEach((link) => {
      const section = document.getElementById(link.id)
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [])

  // Gentle reveal, skipped when reduced motion is requested.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    const items = root.querySelectorAll('[data-reveal]')
    items.forEach((item) => {
      item.classList.add('reveal')
      observer.observe(item)
    })
    return () => observer.disconnect()
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing" ref={rootRef}>
      <a className="skip-link" href="#problem">
        Skip to content
      </a>

      <header className={scrolled ? 'nav is-scrolled' : 'nav'} id="site-nav">
        <div className="container nav__inner">
          <a className="brand" href="#home" aria-label="NutriResQ home">
            <BrandMark />
            <span className="brand__word">
              Nutri<span>ResQ</span>
            </span>
          </a>

          <nav className="nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                className="nav__link"
                href={`#${link.id}`}
                data-spy={link.id}
                aria-current={activeSection === link.id ? 'true' : undefined}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="nav__actions">
            <a className="nav__signin" href="/login">
              Sign In
            </a>
            <a className="btn btn--olive btn--sm" href="/register">
              Get Started
            </a>
          </div>

          <button
            className="nav__toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={menuOpen ? 'mobile-menu is-open' : 'mobile-menu'} id="mobile-menu">
          {NAV_LINKS.map((link) => (
            <a key={link.id} className="mobile-menu__link" href={`#${link.id}`} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <div className="mobile-menu__actions">
            <a className="btn btn--outline" href="/login" onClick={closeMenu}>
              Sign In
            </a>
            <a className="btn btn--olive" href="/register" onClick={closeMenu}>
              Get Started
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero__grid">
            <div className="hero__copy">
              <div className="hero__copy-inner">
                <p className="eyebrow">Smart Food Rescue &amp; Redistribution</p>
                <h1 id="hero-title">
                  Good food deserves a <em className="accent">destination.</em>
                </h1>
                <p className="lede hero__lede">
                  Connecting surplus food with communities that need it through smarter coordination and
                  optimized delivery.
                </p>
                <p className="hero__desc">
                  NutriResQ brings food donors, recipient organizations and delivery partners together to make
                  food redistribution more efficient, organized and impactful.
                </p>
                <div className="hero__ctas">
                  <a className="btn btn--olive" href="/register">
                    Get Started
                  </a>
                  <a className="btn btn--outline" href="#how-it-works">
                    Discover How It Works
                  </a>
                </div>
              </div>
            </div>
            <figure
              className="hero__media media"
              data-alt="Crates of fresh produce and packaged food prepared for donation"
            >
              <img
                src={heroImage}
                alt="Volunteers and crates of fresh produce and packaged food prepared for donation"
                width={1600}
                height={1200}
                fetchPriority="high"
                decoding="async"
                onError={ImageCaptionFallback}
              />
              <figcaption className="hero__caption">
                <p>Every meal deserves a destination.</p>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Problem */}
        <section className="problem" id="problem" aria-labelledby="problem-title">
          <div className="container">
            <div className="problem__top">
              <div className="problem__intro" data-reveal="">
                <p className="eyebrow">The Problem</p>
                <h2 id="problem-title">Good food goes to waste while communities go without.</h2>
                <p>
                  Every day, restaurants, bakeries and supermarkets have surplus food that could serve a
                  meaningful purpose. At the same time, welfare organizations and community kitchens struggle
                  to meet the needs of the people they support.
                </p>
                <p>
                  Sometimes the challenge is not the availability of food. It is getting that food to the right
                  place at the right time.
                </p>
              </div>
              <figure
                className="problem__photo media"
                data-alt="Fresh vegetables and bakery products at a market"
                data-reveal=""
              >
                <img
                  src={problemImage}
                  alt="Fresh vegetables and groceries stacked at a market, the kind of surplus that often goes unused"
                  width={1200}
                  height={1500}
                  loading="lazy"
                  decoding="async"
                  onError={ImageCaptionFallback}
                />
              </figure>
            </div>

            <ol className="problem__list">
              {PROBLEM_ITEMS.map((item, index) => (
                <li className="problem__item" key={item.title} data-reveal="">
                  <span className="problem__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Solution */}
        <section className="solution" id="solution" aria-labelledby="solution-title">
          <div className="container solution__grid">
            <div className="solution__intro" data-reveal="">
              <p className="eyebrow">Our Solution</p>
              <h2 id="solution-title">
                One connected system. A <span className="accent--ul">smarter</span> way to redistribute food.
              </h2>
              <p>
                NutriResQ brings the food redistribution process into one coordinated platform. From surplus
                food collection to recipient matching and delivery planning, every stage is designed to work
                together.
              </p>
            </div>
            <ol className="pillars">
              {PILLARS.map((pillar, index) => (
                <li className="pillar" key={pillar.title} data-reveal="">
                  <span className="pillar__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How it works */}
        <section className="how" id="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <div className="how__head" data-reveal="">
              <p className="eyebrow">How It Works</p>
              <h2 id="how-title">From surplus to service, every step connected.</h2>
              <p className="lede">
                An organized journey that transforms available food into meaningful community support.
              </p>
            </div>

            <ol className="steps">
              <li className="step step--1" data-reveal="">
                <span className="step__num" aria-hidden="true">
                  01
                </span>
                <figure className="media" data-alt="Bakery preparing organized food donations">
                  <img
                    src={collectImage}
                    alt="Fresh bread from a bakery set aside for donation"
                    width={900}
                    height={675}
                    loading="lazy"
                    decoding="async"
                    onError={ImageCaptionFallback}
                  />
                </figure>
                <span className="step__tag">Stage 01</span>
                <h3>Collect &amp; Register</h3>
                <p>
                  Food donors provide available food, quantities, pickup locations, expiry times and other
                  relevant details.
                </p>
              </li>

              <li className="step step--2" data-reveal="">
                <span className="step__num" aria-hidden="true">
                  02
                </span>
                <figure className="media" data-alt="Food packages sorted for recipients">
                  <img
                    src={matchImage}
                    alt="Boxes of food packages being sorted and organized for recipients"
                    width={900}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    onError={ImageCaptionFallback}
                  />
                </figure>
                <span className="step__tag">Stage 02</span>
                <h3>Match &amp; Allocate</h3>
                <p>
                  Available food is evaluated against recipient requirements, urgency, compatibility and
                  available transportation capacity.
                </p>
              </li>

              <li className="step step--3" data-reveal="">
                <span className="step__num" aria-hidden="true">
                  03
                </span>
                <figure className="media">
                  <svg
                    viewBox="0 0 320 240"
                    role="img"
                    aria-label="Simplified delivery route linking pickup points to a delivery destination"
                  >
                    <rect width="320" height="240" fill="#EAE0CD" />
                    <g stroke="#FAF7F0" strokeWidth="9" fill="none">
                      <path d="M0 60H320M0 130H320M0 200H320M60 0V240M150 0V240M240 0V240" />
                    </g>
                    <rect x="160" y="140" width="70" height="50" fill="#858C65" opacity="0.35" />
                    <path
                      d="M30 200H150V130H240V60H290"
                      fill="none"
                      stroke="#626B45"
                      strokeWidth="5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M60 200V60H150"
                      fill="none"
                      stroke="#B85C38"
                      strokeWidth="4"
                      strokeDasharray="9 7"
                    />
                    <circle cx="150" cy="200" r="9" fill="#414A30" />
                    <circle cx="60" cy="60" r="9" fill="#414A30" />
                    <rect x="281" y="51" width="18" height="18" fill="#B85C38" />
                  </svg>
                </figure>
                <span className="step__tag">Stage 03</span>
                <h3>Plan &amp; Optimize</h3>
                <p>
                  Collection and delivery stops are coordinated into efficient routes while accounting for road
                  availability and vehicle limitations.
                </p>
              </li>

              <li className="step step--4" data-reveal="">
                <span className="step__num" aria-hidden="true">
                  04
                </span>
                <figure className="media" data-alt="Volunteers receiving organized food packages">
                  <img
                    src={deliverImage}
                    alt="Volunteers handing out packaged food to community members"
                    width={900}
                    height={1200}
                    loading="lazy"
                    decoding="async"
                    onError={ImageCaptionFallback}
                  />
                </figure>
                <span className="step__tag">Stage 04</span>
                <h3>Deliver &amp; Adapt</h3>
                <p>
                  Delivery plans are reviewed and updated when donations, recipient needs, vehicles or road
                  conditions change.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Platform showcase */}
        <section className="platform" id="platform" aria-labelledby="platform-title">
          <div className="container">
            <div className="platform__head" data-reveal="">
              <p className="eyebrow">The Platform</p>
              <h2 id="platform-title">Complete visibility. Smarter decisions.</h2>
              <p className="lede">
                Everything needed to coordinate food redistribution, brought together in one intelligent
                platform.
              </p>
            </div>

            {/* Showcase 01 */}
            <article className="showcase" data-reveal="">
              <div className="showcase__text">
                <p className="eyebrow">Showcase 01</p>
                <h3>Centralized Operations</h3>
                <p>
                  Manage donors, recipients, food availability, vehicle capacities and operational information
                  in one place.
                </p>
                <p className="showcase__note">Interface shown with illustrative sample data.</p>
              </div>
              <div
                className="ui"
                role="group"
                aria-label="Illustrative preview of the NutriResQ operations overview"
              >
                <div className="ui__bar">
                  <span className="ui__title">
                    <UiMark />
                    Operations overview
                  </span>
                  <span className="ui__badge">Demonstration data</span>
                </div>
                <div className="ui__body ui__body--side">
                  <ul className="ui__side" aria-hidden="true">
                    <li className="is-active">Overview</li>
                    <li>Donations</li>
                    <li>Recipients</li>
                    <li>Fleet</li>
                    <li>Routes</li>
                    <li>Scenarios</li>
                  </ul>
                  <div className="ui__main">
                    <dl className="stats">
                      <div className="stat">
                        <dt>Active donors</dt>
                        <dd>24</dd>
                      </div>
                      <div className="stat">
                        <dt>Recipients</dt>
                        <dd>18</dd>
                      </div>
                      <div className="stat">
                        <dt>Food packages</dt>
                        <dd>249</dd>
                      </div>
                      <div className="stat">
                        <dt>Vehicles available</dt>
                        <dd>
                          5 <small>of 8</small>
                        </dd>
                      </div>
                    </dl>
                    <div>
                      <h4 className="ui__h">Donation inventory</h4>
                      <div
                        className="table-wrap"
                        tabIndex={0}
                        role="region"
                        aria-label="Donation inventory table"
                      >
                        <table className="table">
                          <thead>
                            <tr>
                              <th scope="col">Donor</th>
                              <th scope="col">Item</th>
                              <th scope="col">Qty</th>
                              <th scope="col">Pickup window</th>
                              <th scope="col">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Bakery A</td>
                              <td>Bread loaves</td>
                              <td>60 pcs</td>
                              <td>17:00 to 18:00</td>
                              <td>
                                <span className="tag tag--ready">Ready</span>
                              </td>
                            </tr>
                            <tr>
                              <td>Restaurant B</td>
                              <td>Cooked meals</td>
                              <td>45 boxes</td>
                              <td>21:30 to 22:30</td>
                              <td>
                                <span className="tag tag--matched">Matched</span>
                              </td>
                            </tr>
                            <tr>
                              <td>Supermarket C</td>
                              <td>Produce crates</td>
                              <td>28 crates</td>
                              <td>16:00 to 17:30</td>
                              <td>
                                <span className="tag tag--sched">Scheduled</span>
                              </td>
                            </tr>
                            <tr>
                              <td>Cafe D</td>
                              <td>Pastries</td>
                              <td>36 pcs</td>
                              <td>19:00 to 20:00</td>
                              <td>
                                <span className="tag tag--ready">Ready</span>
                              </td>
                            </tr>
                            <tr>
                              <td>Catering Unit E</td>
                              <td>Packed meals</td>
                              <td>80 boxes</td>
                              <td>20:00 to 21:00</td>
                              <td>
                                <span className="tag tag--matched">Matched</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h4 className="ui__h">Recent activity</h4>
                      <ul className="feed">
                        <li>
                          <time>18:42</time>
                          <span>Community Kitchen 1 confirmed its receiving window.</span>
                        </li>
                        <li>
                          <time>18:10</time>
                          <span>Vehicle V-03 marked available for evening collections.</span>
                        </li>
                        <li>
                          <time>17:35</time>
                          <span>Bakery A listed 60 bread loaves for pickup.</span>
                        </li>
                        <li>
                          <time>17:05</time>
                          <span>Capacity for Vehicle V-01 updated to 450 kg.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Showcase 02 */}
            <article className="showcase showcase--reverse" data-reveal="">
              <div className="showcase__text">
                <p className="eyebrow">Showcase 02</p>
                <h3>Intelligent Route Planning</h3>
                <p>
                  Visualize collection and delivery routes, explore location connectivity and understand how
                  resources are distributed.
                </p>
                <p className="showcase__note">Map and route values are illustrative.</p>
              </div>
              <div
                className="ui"
                role="group"
                aria-label="Illustrative preview of the NutriResQ route planner"
              >
                <div className="ui__bar">
                  <span className="ui__title">
                    <UiMark />
                    Route planner
                  </span>
                  <span className="ui__badge">Demonstration data</span>
                </div>
                <div className="planner">
                  <div
                    className="planner__map"
                    tabIndex={0}
                    role="region"
                    aria-label="Route map, scrolls horizontally on small screens"
                  >
                    <svg
                      viewBox="0 0 640 440"
                      role="img"
                      aria-label="Map showing two vehicle routes between pickup points and delivery locations"
                    >
                      <rect width="640" height="440" fill="#EAE0CD" />
                      <rect x="350" y="215" width="105" height="70" fill="#858C65" opacity="0.35" />
                      <rect x="150" y="125" width="50" height="60" fill="#858C65" opacity="0.35" />
                      <g stroke="#FAF7F0" strokeWidth="5" fill="none">
                        <path d="M0 155H640M0 255H640M0 335H640M165 0V440M270 0V440M400 0V440M505 0V440" />
                      </g>
                      <g stroke="#FAF7F0" strokeWidth="11" fill="none" strokeLinecap="round">
                        <path d="M0 110H640M0 200H640M0 300H640M0 370H640M120 0V440M210 0V440M330 0V440M470 0V440M540 0V440" />
                      </g>
                      <path
                        d="M80 370H210V300V200H120V110H330H470V200"
                        fill="none"
                        stroke="#626B45"
                        strokeWidth="5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <path
                        d="M80 380H330V300H540V370"
                        fill="none"
                        stroke="#B85C38"
                        strokeWidth="4.5"
                        strokeDasharray="11 8"
                        strokeLinejoin="round"
                      />

                      <rect x="64" y="356" width="32" height="28" fill="#FAF7F0" stroke="#414A30" strokeWidth="2" />
                      <text
                        x="80"
                        y="406"
                        fontSize="14"
                        textAnchor="middle"
                        fill="#292A24"
                        fontFamily="DM Sans, sans-serif"
                      >
                        Depot
                      </text>

                      <g
                        fontFamily="DM Sans, sans-serif"
                        fontSize="13"
                        fontWeight="600"
                        fill="#FAF7F0"
                        textAnchor="middle"
                      >
                        <circle cx="120" cy="110" r="14" fill="#414A30" />
                        <text x="120" y="115">
                          P1
                        </text>
                        <circle cx="210" cy="300" r="14" fill="#414A30" />
                        <text x="210" y="305">
                          P2
                        </text>
                        <circle cx="330" cy="110" r="21" fill="none" stroke="#B85C38" strokeWidth="2.5" />
                        <circle cx="330" cy="110" r="14" fill="#414A30" />
                        <text x="330" y="115">
                          P3
                        </text>
                        <circle cx="330" cy="300" r="14" fill="#414A30" />
                        <text x="330" y="305">
                          P4
                        </text>
                        <rect x="456" y="186" width="28" height="28" fill="#B85C38" />
                        <text x="470" y="205">
                          D1
                        </text>
                        <rect x="526" y="356" width="28" height="28" fill="#B85C38" />
                        <text x="540" y="375">
                          D2
                        </text>
                      </g>
                      <g>
                        <rect
                          x="352"
                          y="52"
                          width="150"
                          height="34"
                          fill="#FAF7F0"
                          stroke="#414A30"
                          strokeWidth="1.5"
                        />
                        <text x="364" y="73" fontSize="13" fill="#292A24" fontFamily="DM Sans, sans-serif">
                          P3 pickup, window 16:00
                        </text>
                      </g>
                    </svg>
                  </div>
                  <div className="planner__panel">
                    <div>
                      <h4 className="ui__h">Vehicle</h4>
                      <dl className="kv">
                        <dt>Unit</dt>
                        <dd>V-02, refrigerated van</dd>
                        <dt>Capacity</dt>
                        <dd>450 kg</dd>
                        <dt>Current load</dt>
                        <dd>312 kg</dd>
                      </dl>
                      <div className="meter" aria-hidden="true">
                        <span />
                      </div>
                    </div>
                    <div>
                      <h4 className="ui__h">Routes</h4>
                      <ul className="legend">
                        <li>
                          <i />
                          <span>Route A, 4 stops</span>
                        </li>
                        <li>
                          <i className="is-dash" />
                          <span>Route B, 2 stops</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="ui__h">Selected stops</h4>
                      <ul className="stops">
                        <li className="is-selected">
                          <b>P3</b>
                          <span>Pickup, Supermarket C</span>
                        </li>
                        <li>
                          <b>D1</b>
                          <span>Delivery, Community Kitchen 1</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="ui__h">Route A summary</h4>
                      <dl className="kv">
                        <dt>Distance</dt>
                        <dd>18.4 km</dd>
                        <dt>Est. duration</dt>
                        <dd>52 min</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Showcase 03 */}
            <article className="showcase" data-reveal="">
              <div className="showcase__text">
                <p className="eyebrow">Showcase 03</p>
                <h3>Adaptive Scenario Planning</h3>
                <p>
                  Explore alternative operational scenarios, compare outcomes and generate updated
                  redistribution plans when conditions change.
                </p>
                <p className="showcase__note">All figures are illustrative and do not represent actual operations.</p>
              </div>
              <div
                className="ui"
                role="group"
                aria-label="Illustrative preview of the NutriResQ scenario comparison"
              >
                <div className="ui__bar">
                  <span className="ui__title">
                    <UiMark />
                    Scenario comparison
                  </span>
                  <span className="ui__badge">Demonstration data</span>
                </div>
                <div className="scen">
                  <div className="scen__col">
                    <div className="scen__label">
                      <h4>Original scenario</h4>
                      <span className="tag tag--ready">Active plan</span>
                    </div>
                    <div className="scen__mini">
                      <svg viewBox="0 0 300 200" role="img" aria-label="Original route using the shorter road">
                        <rect width="300" height="200" fill="#EAE0CD" />
                        <path
                          d="M0 100H300M0 170H300M100 0V200M220 0V200M0 40H300"
                          stroke="#FAF7F0"
                          strokeWidth="9"
                          fill="none"
                        />
                        <path
                          d="M20 170H100V100H220V40H280"
                          fill="none"
                          stroke="#626B45"
                          strokeWidth="5"
                          strokeLinejoin="round"
                        />
                        <circle cx="60" cy="170" r="9" fill="#414A30" />
                        <rect x="271" y="31" width="18" height="18" fill="#B85C38" />
                      </svg>
                    </div>
                    <dl className="kv">
                      <dt>Vehicles available</dt>
                      <dd>3</dd>
                      <dt>Selected road</dt>
                      <dd>Open</dd>
                      <dt>Routes</dt>
                      <dd>3</dd>
                      <dt>Total distance</dt>
                      <dd>41.2 km</dd>
                      <dt>Est. completion</dt>
                      <dd>1 h 48 min</dd>
                    </dl>
                  </div>
                  <div className="scen__col">
                    <div className="scen__label">
                      <h4>Modified scenario</h4>
                      <span className="tag tag--matched">Updated plan</span>
                    </div>
                    <div className="scen__mini">
                      <svg
                        viewBox="0 0 300 200"
                        role="img"
                        aria-label="Modified route taking a detour around a closed road"
                      >
                        <rect width="300" height="200" fill="#EAE0CD" />
                        <path
                          d="M0 100H300M0 170H300M100 0V200M220 0V200M0 40H300"
                          stroke="#FAF7F0"
                          strokeWidth="9"
                          fill="none"
                        />
                        <path d="M100 100H220" stroke="#B85C38" strokeWidth="5" strokeDasharray="3 6" />
                        <path
                          d="M153 88l14 24M167 88l-14 24"
                          stroke="#98482D"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        <path
                          d="M20 170H220V40H280"
                          fill="none"
                          stroke="#626B45"
                          strokeWidth="5"
                          strokeLinejoin="round"
                        />
                        <circle cx="60" cy="170" r="9" fill="#414A30" />
                        <rect x="271" y="31" width="18" height="18" fill="#B85C38" />
                      </svg>
                    </div>
                    <dl className="kv">
                      <dt>Vehicles available</dt>
                      <dd className="is-changed">2</dd>
                      <dt>Selected road</dt>
                      <dd className="is-changed">Closed</dd>
                      <dt>Routes</dt>
                      <dd className="is-changed">2</dd>
                      <dt>Total distance</dt>
                      <dd className="is-changed">46.8 km</dd>
                      <dt>Est. completion</dt>
                      <dd className="is-changed">2 h 05 min</dd>
                    </dl>
                  </div>
                </div>
                <div className="scen__log">
                  <h4 className="ui__h">Revised plan</h4>
                  <ul>
                    <li>
                      <span className="tag tag--matched">Road</span>
                      <span>Segment C to D closed. Route 2 now follows the detour along Ring Road.</span>
                    </li>
                    <li>
                      <span className="tag tag--sched">Fleet</span>
                      <span>
                        Vehicle V-03 unavailable. Its stops were reassigned to V-01 and V-02 within capacity.
                      </span>
                    </li>
                    <li>
                      <span className="tag tag--ready">Result</span>
                      <span>All 6 deliveries remain covered with a later estimated completion.</span>
                    </li>
                  </ul>
                  <span className="scen__action">Generate updated plan</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Impact */}
        <section className="impact" id="impact" aria-labelledby="impact-title">
          <div className="container impact__grid">
            <figure
              className="impact__photo media"
              data-alt="Community food support and distribution"
              data-reveal=""
            >
              <img
                src={impactImage}
                alt="Fresh vegetables arranged for community food distribution"
                width={1200}
                height={1500}
                loading="lazy"
                decoding="async"
                onError={ImageCaptionFallback}
              />
            </figure>
            <div className="impact__body" data-reveal="">
              <div className="impact__head">
                <p className="eyebrow">Our Impact</p>
                <h2 id="impact-title">Every redistribution creates an opportunity for impact.</h2>
                <p>
                  By making food redistribution more coordinated and efficient, NutriResQ aims to help reduce
                  avoidable waste, support communities and make better use of available resources.
                </p>
              </div>
              <ul className="impact__list">
                {IMPACT_ITEMS.map((item) => (
                  <li className="impact__item" key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Join */}
        <section className="join" id="join" aria-labelledby="join-title">
          <div className="container">
            <div className="join__head" data-reveal="">
              <div>
                <p className="eyebrow">Join the NutriResQ Network</p>
                <h2 id="join-title">Be part of a better food redistribution network.</h2>
              </div>
              <p>
                Whether you have surplus food to share, serve communities in need or operate a delivery fleet,
                there&apos;s a place for you in NutriResQ.
              </p>
            </div>
            <ul className="roles">
              {ROLES.map((role, index) => (
                <li className="role" key={role.title} data-reveal="">
                  <span className="role__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{role.title}</h3>
                    <p>{role.body}</p>
                  </div>
                  <a className="btn btn--olive role__cta" href={role.href}>
                    {role.cta}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__grid">
            <div>
              <a className="brand" href="#home" aria-label="NutriResQ home">
                <BrandMark tone="footer" />
                <span className="brand__word">
                  Nutri<span>ResQ</span>
                </span>
              </a>
              <p className="footer__about">
                Smarter food redistribution for a more sustainable and connected community.
              </p>
            </div>
            <nav aria-label="Explore">
              <h4>Explore</h4>
              <ul>
                <li>
                  <a href="#home">Home</a>
                </li>
                <li>
                  <a href="#problem">The Problem</a>
                </li>
                <li>
                  <a href="#solution">Our Solution</a>
                </li>
                <li>
                  <a href="#how-it-works">How It Works</a>
                </li>
                <li>
                  <a href="#impact">Our Impact</a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Get started">
              <h4>Get Started</h4>
              <ul>
                <li>
                  <a href="/register?role=donor">Food Donors</a>
                </li>
                <li>
                  <a href="/register?role=recipient">Recipient Organizations</a>
                </li>
                <li>
                  <a href="/register?role=fleet">Fleet Partners</a>
                </li>
                <li>
                  <a href="/login">Sign In</a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Legal">
              <h4>Legal</h4>
              <ul>
                <li>
                  <a href="/privacy">Privacy Policy</a>
                </li>
                <li>
                  <a href="/terms">Terms of Service</a>
                </li>
              </ul>
            </nav>
          </div>
          <p className="footer__bottom">&copy; 2026 NutriResQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
