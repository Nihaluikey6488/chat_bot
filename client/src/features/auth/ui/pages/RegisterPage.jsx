import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, loading, error, clearError } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  async function onSubmit(event) {
    event.preventDefault()
    clearError()
    const result = await register(form)
    if (result.ok) {
      navigate('/chat')
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Set up your workspace in seconds."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Sign in"
    >
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-[#E5E5E5] bg-white px-3 text-[15px] text-[#0D0D0D] outline-none ring-[#10A37F] placeholder:text-[#6E6E80] focus:ring-2 dark:border-[#3A3A3A] dark:bg-[#212121] dark:text-[#ECECEC] dark:placeholder:text-[#A9A9B3]"
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
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
          placeholder="Password (min 8 chars)"
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
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </AuthLayout>
  )
}
