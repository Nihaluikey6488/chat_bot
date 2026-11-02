import './App.css'
import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../features/auth/hooks/useAuth'

function App() {
  const { initialized, bootstrapSession } = useAuth()

  useEffect(() => {
    bootstrapSession()
  }, [bootstrapSession])

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-[#6E6E80] dark:bg-[#212121] dark:text-[#A9A9B3]">
        Restoring session...
      </div>
    )
  }

  return <Outlet />
}

export default App
