'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/appStore'
import { supabase } from '@/lib/supabaseClient'

const AuthPage = dynamic(() => import('@/components/app/AuthPage'), { ssr: false })
const EarlyAccessModal = dynamic(() => import('@/components/modals/EarlyAccessModal'), { ssr: false })
const Toast = dynamic(() => import('@/components/ui/Toast'), { ssr: false })

export default function LoginRoute() {
  const router = useRouter()
  const { login, logout, setPage } = useAppStore()

  useEffect(() => {
    setPage('auth')

    // If already logged in, go straight to app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        login(name, email)
        router.replace('/app')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        login(name, email)
        router.replace('/app')
      }
      if (event === 'SIGNED_OUT') {
        logout()
      }
    })

    return () => subscription.unsubscribe()
  }, [login, logout, router, setPage])

  return (
    <>
      <AuthPage />
      <EarlyAccessModal />
      <Toast />
    </>
  )
}
