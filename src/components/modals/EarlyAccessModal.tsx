'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/appStore'

export default function EarlyAccessModal() {
  const { earlyAccessOpen, setEarlyAccessOpen } = useAppStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function close() {
    setEarlyAccessOpen(false)
    setTimeout(() => { setSuccess(false); setName(''); setEmail(''); setError('') }, 300)
  }

  function submit() {
    setError('')
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    try {
      const existing = JSON.parse(localStorage.getItem('mp_waitlist') || '[]')
      existing.push({ name: name.trim(), email: email.trim(), ts: Date.now() })
      localStorage.setItem('mp_waitlist', JSON.stringify(existing))
    } catch (_) {}
    setSuccess(true)
  }

  if (!earlyAccessOpen) return null

  return (
    <div className="modal-overlay visible" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          {!success ? (
            <>
              <div className="modal-title">Get early access</div>
              <div className="modal-subtitle">Leave your name and email. We&rsquo;ll reach out when Myndzprint goes fully live.</div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div className="modal-title">You&rsquo;re on the list.</div>
              <div className="modal-subtitle">We&rsquo;ll be in touch when the doors open. Watch your inbox.</div>
            </div>
          )}
          <button
            onClick={close}
            style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}
          >✕</button>
        </div>

        {!success && (
          <>
            <div className="modal-body">
              {error && (
                <div style={{ background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label className="modal-label">Name</label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('ea-email-input')?.focus()}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="modal-label">Email</label>
                <input
                  id="ea-email-input"
                  className="modal-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="modal-btn" onClick={close}>Cancel</button>
              <button className="modal-btn gold" onClick={submit}>Join the waitlist</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
