import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Myndzprint. Any mind. Any time. Any place.',
  description: 'The thinkers who shaped you — reachable whenever you need them.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
