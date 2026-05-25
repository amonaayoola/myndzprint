'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { supabase, updatePassword } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase sends the user back with a session in the URL hash.
  // detectSessionInUrl: true in the client handles this automatically —
  // we just wait for the session to be established.
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function submit() {
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: unknown) {
      setError((err as Error).message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page auth active" id="page-auth">
      <div className="auth-wrap">
        <div className="spotlight" id="auth-spotlight" />
        <div className="auth-card" style={done || !ready ? { textAlign: 'center' } : {}}>
          <div className="auth-logo" style={{ justifyContent: done || !ready ? 'center' : undefined, marginBottom: 24 }} onClick={() => router.push('/')}>
            <Logo size={22} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>
              Myndz<span style={{ color: 'var(--gold)' }}>print</span>
            </div>
          </div>

          {done ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
              <h1 className="auth-h1" style={{ fontSize: 22 }}>Password updated.</h1>
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
                Redirecting you to sign in…
              </p>
            </>
          ) : !ready ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <h1 className="auth-h1" style={{ fontSize: 22 }}>Verifying your link…</h1>
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
                If this takes too long, your link may have expired. <br />
                <span
                  style={{ color: 'var(--gold)', cursor: 'pointer' }}
                  onClick={() => router.push('/login')}
                >
                  Request a new one
                </span>
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-h1">Set a new password.</h1>
              <p className="auth-lede">Choose something you will remember.</p>

              {error && (
                <div style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">New password</label>
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

              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
