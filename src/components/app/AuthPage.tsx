'use client'
import { useState } from 'react'
import Logo from '@/components/ui/Logo'
import { useAppStore } from '@/store/appStore'
import { track } from '@/lib/analytics'
import { authSignUp, authSignIn } from '@/lib/supabaseClient'

export default function AuthPage() {
  const { authMode, setAuthMode, login } = useAppStore()
  const isLogin = authMode === 'login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function submit() {
    setError('')
    if (!isLogin && !name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters.'); return
    }

    setLoading(true)

    try {
      if (isLogin) {
        // ── Sign in via Supabase Auth ──────────────────────────────────────
        const data = await authSignIn(email.trim(), password)
        const displayName = data.user?.user_metadata?.name || email.split('@')[0]
        track('login', { userEmail: email.trim() })
        login(displayName, email.trim())
      } else {
        // ── Sign up via Supabase Auth ──────────────────────────────────────
        const data = await authSignUp(name.trim(), email.trim(), password)

        if (data.session) {
          // Email confirmation is disabled — user is immediately signed in
          track('signup', { userEmail: email.trim(), metadata: { name: name.trim() } })
          login(name.trim(), email.trim())
        } else {
          // Email confirmation required — tell user to check their inbox
          setEmailSent(true)
        }
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Something went wrong.'
      // Translate Supabase error messages into friendly ones
      if (msg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.')
      } else if (msg.includes('User already registered')) {
        setError('An account with that email already exists. Sign in instead.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in. Check your inbox.')
      } else if (msg.includes('Password should be')) {
        setError('Password must be at least 6 characters.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Email confirmation pending screen ──────────────────────────────────────
  if (emailSent) {
    return (
      <div className="page auth active" id="page-auth">
        <div className="auth-wrap">
          <div className="spotlight" id="auth-spotlight" />
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
              <Logo size={22} />
            </div>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
            <h1 className="auth-h1" style={{ fontSize: 22 }}>Check your inbox</h1>
            <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Click the link to activate your account, then come back and sign in.
            </p>
            <button
              className="modal-btn"
              style={{ marginTop: 28, width: '100%' }}
              onClick={() => { setEmailSent(false); setAuthMode('login') }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page auth active" id="page-auth">
      <div className="auth-wrap">
        <div className="spotlight" id="auth-spotlight" />
        <div className="auth-card">
          <div className="auth-logo" onClick={() => useAppStore.getState().setPage('landing')}>
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
              <input
                className="form-input"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void submit() }}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit() }}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit() }}
              disabled={loading}
            />
          </div>

          <button
            className="auth-submit"
            onClick={() => void submit()}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? (isLogin ? 'Signing in…' : 'Creating account…')
              : (isLogin ? 'Sign in' : 'Create account')}
          </button>

          <div className="auth-switch">
            <span>{isLogin ? "Don't have an account? " : 'Already have an account? '}</span>
            <span
              style={{ cursor: 'pointer', color: 'var(--gold)' }}
              onClick={() => { setAuthMode(isLogin ? 'signup' : 'login'); setError('') }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
