'use client'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { useLogin } from '@privy-io/react-auth'

export default function AuthPage() {
  const router = useRouter()
  const { login } = useLogin()

  return (
    <div className="page auth active" id="page-auth">
      <div className="auth-wrap">
        <div className="spotlight" id="auth-spotlight" />
        <div className="auth-card">
          <div className="auth-logo" onClick={() => router.push('/')}>
            <Logo size={22} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>
              Myndz<span style={{ color: 'var(--gold)' }}>print</span>
            </div>
          </div>

          <h1 className="auth-h1">Welcome to Myndzprint.</h1>
          <p className="auth-lede">Sign in or create an account with your email to continue.</p>

          <button
            className="auth-submit"
            onClick={() => login()}
          >
            Continue with email
          </button>
        </div>
      </div>
    </div>
  )
}
