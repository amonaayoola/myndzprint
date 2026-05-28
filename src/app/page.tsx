'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/appStore'
import { usePrivy } from '@privy-io/react-auth'

const LandingPage = dynamic(() => import('@/components/landing/LandingPage'), { ssr: false })
const EarlyAccessModal = dynamic(() => import('@/components/modals/EarlyAccessModal'), { ssr: false })
const Toast = dynamic(() => import('@/components/ui/Toast'), { ssr: false })

export default function Home() {
  const router = useRouter()
  const { login, setPage } = useAppStore()
  const { ready, authenticated, user } = usePrivy()

  useEffect(() => {
    setPage('landing')
  }, [setPage])

  useEffect(() => {
    if (!ready) return
    if (authenticated && user) {
      const email = user.email?.address || ''
      const name = email.split('@')[0] || 'User'
      login(name, email)
      router.replace('/app')
    }
  }, [ready, authenticated, user, login, router])

  return (
    <>
      <LandingPage />
      <EarlyAccessModal />
      <Toast />
    </>
  )
}
