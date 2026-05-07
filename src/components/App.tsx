'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import LandingPage from '@/components/landing/LandingPage'
import AuthPage from '@/components/app/AuthPage'
import AppShell from '@/components/app/AppShell'
import EarlyAccessModal from '@/components/modals/EarlyAccessModal'
import BuildModal from '@/components/modals/BuildModal'
import Toast from '@/components/ui/Toast'
import { supabase } from '@/lib/supabaseClient'

export default function App() {
  const { page, login, logout } = useAppStore()

  useEffect(() => {
    // On mount: restore session if Supabase already has one (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        // Only auto-login if we're not already in the app
        if (useAppStore.getState().page !== 'app') {
          login(name, email)
        }
      }
    })

    // Listen for auth state changes (sign-in from email confirmation link, token refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const email = session.user.email || ''
        if (useAppStore.getState().page !== 'app') {
          login(name, email)
        }
      }
      if (event === 'SIGNED_OUT') {
        if (useAppStore.getState().page === 'app') {
          logout()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [login, logout])

  return (
    <>
      {page === 'landing' && <LandingPage />}
      {page === 'auth' && <AuthPage />}
      {page === 'app' && <AppShell />}
      <EarlyAccessModal />
      <BuildModal />
      <Toast />
    </>
  )
}
