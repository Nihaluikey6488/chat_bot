import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, error, clearError } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })

  async function onSubmit(event) {
    event.preventDefault()
    clearError()
    const result = await login(form)
    if (result.ok) {
      navigate('/chat')
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your conversations."
      footerText="No account yet?"
      footerLink="/register"
      footerLabel="Create account"
    >
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-[#E5E5E5] bg-white px-3 text-[15px] text-[#0D0D0D] outline-none ring-[#10A37F] placeholder:text-[#6E6E80] focus:ring-2 dark:border-[#3A3A3A] dark:bg-[#212121] dark:text-[#ECECEC] dark:placeholder:text-[#A9A9B3]"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <input
          className="h-11 rounded-lg border border-[#E5E5E5] bg-white px-3 text-[15px] text-[#0D0D0D] outline-none ring-[#10A37F] placeholder:text-[#6E6E80] focus:ring-2 dark:border-[#3A3A3A] dark:bg-[#212121] dark:text-[#ECECEC] dark:placeholder:text-[#A9A9B3]"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
        {error && <p className="text-[13px] text-[#EF4444]">{error}</p>}
        <button
          className="h-11 rounded-lg bg-[#10A37F] text-white transition-colors hover:bg-[#1A7F64] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <Link
        className="mt-3 inline-block text-sm font-medium text-[#10A37F] transition-colors hover:text-[#1A7F64]"
        to="/forgot-password"
      >
        Forgot password?
      </Link>
    </AuthLayout>
  )
}
