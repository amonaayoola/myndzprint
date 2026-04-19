'use client'
import { useEffect } from 'react'
import Navbar from './Navbar'
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
