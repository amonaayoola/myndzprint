'use client'
import { useEffect } from 'react'
import Navbar from './Navbar'
import { track } from '@/lib/analytics'
import Hero from './Hero'
import Marquee from './Marquee'
import HowSection from './HowSection'

function initRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed') }),
    { threshold: 0.12 }
  )
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
  return observer
}

function initCursorSpotlight() {
  const hero = document.querySelector('.hero') as HTMLElement | null
  const heroSpot = document.getElementById('hero-spotlight')
  if (!hero || !heroSpot) return

  const r = hero.getBoundingClientRect()
  heroSpot.style.transform = `translate3d(${r.width / 2}px, ${r.height / 2}px, 0)`

  let rafId: number | null = null
  let heroX = 0, heroY = 0, touched = false

  const apply = () => {
    rafId = null
    if (touched && heroSpot) heroSpot.style.transform = `translate3d(${heroX}px, ${heroY}px, 0)`
  }

  const onMove = (e: PointerEvent) => {
    if (hero.offsetParent !== null) {
      const rect = hero.getBoundingClientRect()
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        heroX = e.clientX - rect.left
        heroY = e.clientY - rect.top
        touched = true
      }
    }
    if (!rafId) rafId = requestAnimationFrame(apply)
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  return () => document.removeEventListener('pointermove', onMove)
}

export default function LandingPage() {
  useEffect(() => {
    track('page_visit')
    const observer = initRevealObserver()
    const cleanup = initCursorSpotlight()
    return () => {
      observer.disconnect()
      cleanup?.()
    }
  }, [])

  return (
    <div className="page landing active" id="page-landing">
      <Navbar />
      <Hero />
      <Marquee />
      <HowSection />

      {/* B2B SECTION */}
      <section id="b2b" style={{ padding: '100px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>For Business</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text)', marginBottom: 20 }}>
            Your organization&apos;s knowledge.<br /><em>Always reachable.</em>
          </h2>
          <p style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.8, color: 'var(--text2)', maxWidth: 560, margin: '0 auto' }}>
            Give your team, community, or customers access to the expertise that lives inside your organization — through minds built on the people and material that matter most.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, marginBottom: 56 }}>
          {[
            { title: 'Internal knowledge base', desc: 'Build minds from your internal documentation, founders, and subject matter experts. New hires onboard faster. Institutional knowledge never walks out the door.' },
            { title: 'Community voices', desc: 'Publish minds of your most trusted contributors and community leaders. Let your audience access their thinking anytime, at scale.' },
            { title: 'Customer-facing AI', desc: 'Give your customers a mind that thinks like your best support rep, advisor, or product expert — grounded in your actual content.' },
          ].map(b => (
            <div key={b.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: 32 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{b.title}</div>
              <div style={{ fontSize: 14, fontWeight: 300, color: 'var(--text2)', lineHeight: 1.72 }}>{b.desc}</div>
            </div>
          ))}
        </div>

        <div className="reveal" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 24 }}>Interested in Myndzprint for your team or organization?</p>
          <a
            href="mailto:hello@myndzprint.com"
            style={{ display: 'inline-block', padding: '14px 36px', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 13, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all .2s' }}
          >
            Get in touch
          </a>
        </div>
      </section>

      <div className="pull-quote texture">
        <p className="q reveal">
          &ldquo;The people who shaped how you think: <em>what would they say</em> about what you&rsquo;re facing right now?&rdquo;
        </p>
        <p className="attr reveal">The question Myndzprint exists to answer</p>
      </div>

      <footer className="footer">
        <span className="brand">Myndz<span>print</span></span>
        <ul>
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
        <span className="copy">&copy; {new Date().getFullYear()} Myndzprint</span>
      </footer>
    </div>
  )
}
