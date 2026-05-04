'use client'
import { useState } from 'react'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'
import { track } from '@/lib/analytics'

// Bug #1 fix: hash passwords with SHA-256 via Web Crypto API before storing/comparing
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Bug #15 fix: safe localStorage parse helper
function safeParseUsers(): { email: string; password: string; name: string }[] {
  try {
    const stored = localStorage.getItem('mp_demo_users')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export default function AuthPage() {
  const { authMode, setAuthMode, setPage, login } = useAppStore()
  const isLogin = authMode === 'login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Bug #1 fix: submit is now async to await the SHA-256 hash
  async function submit() {
    setError('')
    if (!isLogin && !name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    if (!password.trim() || password.length < 4) {
      setError('Please enter a password (min 4 characters).'); return
    }

    // Bug #1 fix: hash the password before comparing or storing
    const hashedPassword = await hashPassword(password)

    // Demo auth — store locally
    if (isLogin) {
      // Bug #15 fix: JSON.parse wrapped in try/catch via safeParseUsers
      const users = safeParseUsers()
      const found = users.find(u => u.email === email.trim() && u.password === hashedPassword)
      if (!found) { setError('No account found with those details.'); return }
      track('login', { userEmail: email.trim() })
      login(found.name, email.trim())
    } else {
      // Bug #15 fix: JSON.parse wrapped in try/catch via safeParseUsers
      const users = safeParseUsers()
      const exists = users.find(u => u.email === email.trim())
      if (exists) { setError('An account with that email already exists. Sign in instead.'); return }
      // Bug #1 fix: store hashed password, never plaintext
      users.push({ name: name.trim(), email: email.trim(), password: hashedPassword })
      try {
        localStorage.setItem('mp_demo_users', JSON.stringify(users))
      } catch {
        setError('Could not save account. Storage may be unavailable.'); return
      }
      track('signup', { userEmail: email.trim(), metadata: { name: name.trim() } })
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
              <input className="form-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit() }} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit() }} />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit() }} />
          </div>

          <button className="auth-submit" onClick={() => void submit()}>{isLogin ? 'Sign in' : 'Create account'}</button>

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
