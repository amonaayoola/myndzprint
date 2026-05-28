'use client'
import { PrivyProvider } from '@privy-io/react-auth'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''

export default function PrivyProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: {
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
