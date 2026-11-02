import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'

export function ForgotPasswordPage() {
  const { forgotPassword, loading, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    clearError()
    setMessage('')

    const result = await forgotPassword({ email })
    if (result.ok) {
      setMessage(result.data.resetToken ? `Reset token (dev): ${result.data.resetToken}` : result.data.message)
    }
  }

  return (
    <AuthLayout
      title="Recover account"
      subtitle="Enter your email and we'll generate a reset flow."
      footerText="Remembered your password?"
      footerLink="/login"
      footerLabel="Back to login"
    >
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input
          className="h-11 rounded-lg border border-[#E5E5E5] bg-white px-3 text-[15px] text-[#0D0D0D] outline-none ring-[#10A37F] placeholder:text-[#6E6E80] focus:ring-2 dark:border-[#3A3A3A] dark:bg-[#212121] dark:text-[#ECECEC] dark:placeholder:text-[#A9A9B3]"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {error && <p className="text-[13px] text-[#EF4444]">{error}</p>}
        {message && <p className="text-[13px] text-[#10A37F]">{message}</p>}
        <button
          className="h-11 rounded-lg bg-[#10A37F] text-white transition-colors hover:bg-[#1A7F64] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}
