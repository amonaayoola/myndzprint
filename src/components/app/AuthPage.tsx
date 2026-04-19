'use client'
import { useState } from 'react'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'

export default function AuthPage() {
  const { authMode, setAuthMode, setPage, login } = useAppStore()
  const isLogin = authMode === 'login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit() {
    setError('')
    if (!isLogin && !name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    if (!password.trim() || password.length < 4) {
      setError('Please enter a password (min 4 characters).'); return
    }
    // Demo auth — store locally
    if (isLogin) {
      const stored = localStorage.getItem('mp_demo_users')
      const users = stored ? JSON.parse(stored) : []
      const found = users.find((u: { email: string; password: string; name: string }) =>
        u.email === email.trim() && u.password === password
      )
      if (!found) { setError('No account found with those details.'); return }
      login(found.name, email.trim())
    } else {
      const users = JSON.parse(localStorage.getItem('mp_demo_users') || '[]')
      const exists = users.find((u: { email: string }) => u.email === email.trim())
      if (exists) { setError('An account with that email already exists. Sign in instead.'); return }
      users.push({ name: name.trim(), email: email.trim(), password })
      localStorage.setItem('mp_demo_users', JSON.stringify(users))
      login(name.trim(), email.trim())
    }
  }

  return (
    <div className="page auth active" id="page-auth">
      <div className="auth-wrap">
        <div className="spotlight" id="auth-spotlight" />
        <div className="auth-card">
          <div className="auth-logo" onClick={() => setPage('landing')}>
            <Logo size={22} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>
              Myndz<span style={{ color: 'var(--gold)' }}>print</span>
            </div>
          </div>

          <h1 className="auth-h1">{isLogin ? 'Welcome back.' : 'Create your account.'}</h1>
          <p className="auth-lede">{isLogin ? 'Sign in to continue your conversations.' : 'Join Myndzprint and start talking.'}</p>

          {error && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          <button className="auth-submit" onClick={submit}>{isLogin ? 'Sign in' : 'Create account'}</button>

          <div className="auth-switch">
            <span>{isLogin ? "Don't have an account? " : 'Already have an account? '}</span>
            <span style={{ cursor: 'pointer', color: 'var(--gold)' }} onClick={() => { setAuthMode(isLogin ? 'signup' : 'login'); setError('') }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
