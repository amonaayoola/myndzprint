'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabaseClient'

const AppShell = dynamic(() => import('@/components/app/AppShell'), { ssr: false })
const EarlyAccessModal = dynamic(() => import('@/components/modals/EarlyAccessModal'), { ssr: false })
const BuildModal = dynamic(() => import('@/components/modals/BuildModal'), { ssr: false })
const Toast = dynamic(() => import('@/components/ui/Toast'), { ssr: false })

export default function AppRoute() {
  const router = useRouter()
  const { login, logout, setPage } = useAppStore()

  useEffect(() => {
    setPage('app')

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        login(name, email)
      } else {
        // Not authenticated — send to login
        router.replace('/login')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        login(name, email)
      }
      if (event === 'SIGNED_OUT') {
        logout()
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [login, logout, router, setPage])

  return (
    <>
      <AppShell />
      <EarlyAccessModal />
      <BuildModal />
      <Toast />
    </>
  )
}
