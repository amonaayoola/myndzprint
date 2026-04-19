'use client'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'

export default function Navbar() {
  const { setPage, setAuthMode, setEarlyAccessOpen } = useAppStore()

  return (
    <div className="navbar-wrap">
      <nav className="navbar">
        <div className="logo-row" onClick={() => setPage('landing')}>
          <Logo size={24} />
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>
            Myndz<span style={{ color: 'var(--gold)' }}>print</span>
          </div>
        </div>

        <div className="nav-center">
          <a href="#how">How it works</a>
          <a href="#minds">Minds</a>
        </div>

        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => { setAuthMode('login'); setPage('auth') }}>Sign in</button>
          <button className="btn-primary" onClick={() => setEarlyAccessOpen(true)}>Get early access</button>
        </div>
      </nav>
    </div>
  )
}
