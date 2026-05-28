'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/appStore'
import { usePrivy } from '@privy-io/react-auth'

const AppShell = dynamic(() => import('@/components/app/AppShell'), { ssr: false })
const EarlyAccessModal = dynamic(() => import('@/components/modals/EarlyAccessModal'), { ssr: false })
const BuildModal = dynamic(() => import('@/components/modals/BuildModal'), { ssr: false })
const Toast = dynamic(() => import('@/components/ui/Toast'), { ssr: false })

export default function AppRoute() {
  const router = useRouter()
  const { login, setPage } = useAppStore()
  const { ready, authenticated, user } = usePrivy()

  useEffect(() => {
    setPage('app')
  }, [setPage])

  useEffect(() => {
    if (!ready) return
    if (authenticated && user) {
      const email = user.email?.address || ''
      const name = email.split('@')[0] || 'User'
      login(name, email)
    } else if (!authenticated) {
      router.replace('/login')
    }
  }, [ready, authenticated, user, login, router])

  return (
    <>
      <AppShell />
      <EarlyAccessModal />
      <BuildModal />
      <Toast />
    </>
  )
}
