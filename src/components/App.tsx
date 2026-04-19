'use client'
import { useAppStore } from '@/store/appStore'
import LandingPage from '@/components/landing/LandingPage'
import AuthPage from '@/components/app/AuthPage'
import AppShell from '@/components/app/AppShell'
import EarlyAccessModal from '@/components/modals/EarlyAccessModal'
import BuildModal from '@/components/modals/BuildModal'
import Toast from '@/components/ui/Toast'

export default function App() {
  const page = useAppStore(s => s.page)

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
