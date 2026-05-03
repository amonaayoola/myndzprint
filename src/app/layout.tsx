import type { Metadata } from 'next'
import './globals.css'
// Bug #16 fix: import error boundary to catch unhandled render errors app-wide
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Myndzprint. Any mind. Any time. Any place.',
  description: 'The thinkers who shaped you, reachable whenever you need them.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Bug #16 fix: wrap entire app in error boundary */}
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
