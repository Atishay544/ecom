'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tab = 'google' | 'password' | 'email' | 'phone'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('password')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [step, setStep] = useState<'input' | 'otp' | 'check-email'>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  function switchTab(t: Tab) {
    setTab(t); setStep('input'); setError(''); setIsSignUp(false)
  }

  async function handleGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function handlePasswordAuth() {
    setLoading(true); setError('')
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      setLoading(false)
      if (error) return setError(error.message)
      // If email confirmation is required, session will be null
      if (!data.session) {
        setStep('check-email')
        return
      }
      router.push('/')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) return setError(error.message)
      router.push('/')
    }
  }

  async function handleEmailOtp() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) return setError(error.message)
    setStep('otp')
  }

  async function handleEmailVerify() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
    setLoading(false)
    if (error) return setError(error.message)
    router.push('/')
  }

  async function handlePhoneOtp() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : `+91${phone}`
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if (error) return setError(error.message)
    setStep('otp')
  }

  async function handlePhoneVerify() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : `+91${phone}`
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    setLoading(false)
    if (error) return setError(error.message)
    router.push('/')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'google',   label: 'Google' },
    { key: 'password', label: 'Email' },
    { key: 'email',    label: 'Magic Link' },
    { key: 'phone',    label: 'Phone' },
  ]

  const inputCls = [
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm',
    'bg-white text-gray-900 placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent',
    'transition',
    // Override browser autofill blue background
    '[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white]',
  ].join(' ')

  const btnPrimary = [
    'w-full py-3 rounded-xl text-sm font-semibold transition',
    'bg-gray-900 text-white hover:bg-black',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' ')

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-7">
              <h1 className="text-xl font-bold text-gray-900">
                {tab === 'password' && step === 'check-email' && 'Almost there!'}
                {tab === 'password' && step !== 'check-email' && (isSignUp ? 'Create account' : 'Welcome back')}
                {tab === 'google'   && 'Sign in'}
                {tab === 'email'    && 'Magic link'}
                {tab === 'phone'    && 'Phone sign in'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {tab === 'password' && step === 'check-email' && 'Verify your email to continue'}
                {tab === 'password' && step !== 'check-email' && (isSignUp ? 'Fill in your details below' : 'Sign in to your account')}
                {tab === 'google'   && 'Use your Google account'}
                {tab === 'email'    && 'Get a one-time link by email'}
                {tab === 'phone'    && 'Get an OTP on your phone'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6 gap-1">
              {tabs.map(t => (
                <button key={t.key} onClick={() => switchTab(t.key)}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
                    tab === t.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            {/* ── Google ── */}
            {tab === 'google' && (
              <button onClick={handleGoogle} disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Redirecting…' : 'Continue with Google'}
              </button>
            )}

            {/* ── Email + Password ── */}
            {tab === 'password' && step === 'input' && (
              <div className="space-y-3">
                <input type="email" placeholder="Email address" value={email}
                  onChange={e => setEmail(e.target.value)} className={inputCls} />
                <input type="password" placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)} className={inputCls} />
                <button onClick={handlePasswordAuth} disabled={loading || !email || !password}
                  className={btnPrimary}>
                  {loading ? '…' : isSignUp ? 'Create account' : 'Sign in'}
                </button>
                <button onClick={() => { setIsSignUp(s => !s); setError('') }}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-800 transition pt-1">
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            )}

            {/* ── Check email (after sign up with confirmation required) ── */}
            {tab === 'password' && step === 'check-email' && (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Check your inbox</p>
                  <p className="text-xs text-gray-500 mt-1">
                    We sent a verification link to<br />
                    <span className="font-medium text-gray-800">{email}</span>
                  </p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Click the link in the email to verify your account. You'll be signed in automatically — no need to fill anything again.
                </p>
                <button
                  onClick={() => { setStep('input'); setError(''); setPassword('') }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition pt-1">
                  ← Use a different email
                </button>
              </div>
            )}

            {/* ── Magic Link / Email OTP ── */}
            {tab === 'email' && step === 'input' && (
              <div className="space-y-3">
                <input type="email" placeholder="Email address" value={email}
                  onChange={e => setEmail(e.target.value)} className={inputCls} />
                <button onClick={handleEmailOtp} disabled={loading || !email}
                  className={btnPrimary}>
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </div>
            )}
            {tab === 'email' && step === 'otp' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center">Enter the 6-digit code sent to <span className="font-medium text-gray-800">{email}</span></p>
                <input type="text" placeholder="000000" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className={`${inputCls} text-center text-2xl tracking-[0.5em] font-mono`} />
                <button onClick={handleEmailVerify} disabled={loading || otp.length < 6} className={btnPrimary}>
                  {loading ? 'Verifying…' : 'Verify code'}
                </button>
                <button onClick={() => setStep('input')} className="w-full text-xs text-gray-400 hover:text-gray-600 transition">
                  ← Change email
                </button>
              </div>
            )}

            {/* ── Phone OTP ── */}
            {tab === 'phone' && step === 'input' && (
              <div className="space-y-3">
                <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-black transition">
                  <span className="bg-gray-50 px-4 flex items-center text-gray-500 text-sm border-r border-gray-200">+91</span>
                  <input type="tel" placeholder="10-digit number" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 px-4 py-3 text-sm bg-white outline-none" maxLength={10} />
                </div>
                <button onClick={handlePhoneOtp} disabled={loading || phone.length < 10}
                  className={btnPrimary}>
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            )}
            {tab === 'phone' && step === 'otp' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center">Enter the OTP sent to <span className="font-medium text-gray-800">+91{phone}</span></p>
                <input type="text" placeholder="000000" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className={`${inputCls} text-center text-2xl tracking-[0.5em] font-mono`} />
                <button onClick={handlePhoneVerify} disabled={loading || otp.length < 6} className={btnPrimary}>
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>
                <button onClick={() => setStep('input')} className="w-full text-xs text-gray-400 hover:text-gray-600 transition">
                  ← Change number
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            By signing in you agree to our Terms & Privacy Policy
          </p>
        </div>
      </div>
    </>
  )
}
