'use client'
import { useEffect, useState } from 'react'
import HeroCanvas from './HeroCanvas'
import { useAppStore } from '@/store/appStore'
import { HERO_PHRASES, TAGLINES } from '@/data/static'

export default function Hero() {
  const { setEarlyAccessOpen } = useAppStore()
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [tagIdx, setTagIdx] = useState(0)
  const [tagVisible, setTagVisible] = useState(true)
  const [phraseVisible, setPhraseVisible] = useState(true)

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setPhraseVisible(false)
      setTimeout(() => { setPhraseIdx(i => (i + 1) % HERO_PHRASES.length); setPhraseVisible(true) }, 400)
    }, 3200)
    return () => clearInterval(phraseTimer)
  }, [])

  useEffect(() => {
    const tagTimer = setInterval(() => {
      setTagVisible(false)
      setTimeout(() => { setTagIdx(i => (i + 1) % TAGLINES.length); setTagVisible(true) }, 600)
    }, 6200)
    return () => clearInterval(tagTimer)
  }, [])

  return (
    <section className="hero texture">
      <HeroCanvas />
      <div className="spotlight" id="hero-spotlight" />

      <div className="hero-inner">
        <div className="hero-pill">
          <span className="dot" />
          Now in early access · always on
        </div>

        <div className="hero-title">
          <span
            className="phrase active"
            style={{
              opacity: phraseVisible ? 1 : 0,
              transform: phraseVisible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
              display: 'block',
            }}
          >
            {HERO_PHRASES[phraseIdx]}
          </span>
        </div>

        <div className="hero-subtitle">within reach.</div>

        <p
          className="hero-tag"
          style={{
            opacity: tagVisible ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          {TAGLINES[tagIdx]}
        </p>

        <div className="hero-actions">
          <button className="hero-cta" onClick={() => setEarlyAccessOpen(true)}>
            Get early access
          </button>
          <a href="#how" className="hero-cta ghost">See how it works</a>
        </div>
      </div>

      <div className="scroll-hint">
        <div className="line" />
        <span>Scroll</span>
      </div>
    </section>
  )
}
