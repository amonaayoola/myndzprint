'use client'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'

export default function Navbar() {
  const router = useRouter()
  const { setAuthMode } = useAppStore()

  return (
    <div className="navbar-wrap">
      <nav className="navbar">
        <div className="logo-row" onClick={() => router.push('/')}>
          <Logo size={24} />
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>
            Myndz<span style={{ color: 'var(--gold)' }}>print</span>
          </div>
        </div>

        <div className="nav-center">
          <a href="#how">How it works</a>
          <a href="#minds">Minds</a>
          <a href="#b2b">For Business</a>
          <a href="/whitepaper.html">Whitepaper</a>
        </div>

        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => { setAuthMode('login'); router.push('/login') }}>Sign in</button>
          <span className="btn-primary" style={{ cursor: 'default', opacity: 0.6, pointerEvents: 'none' }}>Get early access</span>
        </div>
      </nav>
    </div>
  )
}
