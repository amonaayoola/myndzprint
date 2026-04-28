'use client'
/**
 * ErrorBoundary.tsx
 * Bug #16 fix: React error boundary to catch unhandled render/lifecycle errors.
 * Wraps the root in layout.tsx to prevent a blank screen on unexpected errors.
 */
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#ccc',
          background: '#0d0d0d',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: '#fff' }}>
            Something went wrong.
          </h2>
          <p style={{ fontSize: 14, color: '#888', maxWidth: 380, lineHeight: 1.6, marginBottom: 24 }}>
            {this.state.message || 'An unexpected error occurred. Refresh the page to try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #444',
              background: 'transparent',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
