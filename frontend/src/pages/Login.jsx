import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm]           = useState({ email: '', password: '' })
  const [loading, setLoading]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // OTP step
  const [step, setStep]           = useState('credentials') // 'credentials' | 'otp' | 'unverified'
  const [otp, setOtp]             = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef([])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── Step 1: credentials ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    try {
      const res = await API.post('/users/login', { email: form.email, password: form.password })

      if (res.data.requires_otp) {
        toast.success('OTP sent to your email 📧')
        setStep('otp')
        setResendCooldown(60)
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'EMAIL_NOT_VERIFIED') {
        toast.error('Email not verified. A new OTP has been sent.')
        setStep('unverified')
        setResendCooldown(60)
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Login failed. Check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: OTP input ────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.join('')
    if (code.length < 6) { toast.error('Enter all 6 digits'); return }
    setOtpLoading(true)
    try {
      const res = await API.post('/users/verify-login-otp', { email: form.email, otp: code })
      const userRole = res.data.user?.role || 'owner'
      login(res.data.access_token, {
        id:    res.data.user?.id,
        email: form.email,
        role:  userRole,
        name:  res.data.user?.name,
        phone: res.data.user?.phone || ''
      })
      toast.success(`Welcome back, ${res.data.user?.name}! 👋`)
      navigate(userRole === 'tenant' ? '/tenant' : '/owner')
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Invalid OTP')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setOtpLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await API.post('/users/resend-otp', { email: form.email, purpose: 'login' })
      toast.success('New OTP sent 📧')
      setOtp(['', '', '', '', '', ''])
      setResendCooldown(60)
      otpRefs.current[0]?.focus()
    } catch {
      toast.error('Failed to resend OTP')
    }
  }

  // ── Render OTP step ──────────────────────────────────────────
  if (step === 'otp' || step === 'unverified') {
    const purpose = step === 'unverified' ? 'signup' : 'login'
    return (
      <div className={styles.authContainer}>
        <div className={styles.leftPanel}>
          <button onClick={() => setStep('credentials')} className={styles.backBtn}>← Back</button>
          <div className={styles.leftContent}>
            <div className={styles.leftLogo}>🔐</div>
            <h2>Verify It's You</h2>
            <p>A 6-digit code was sent to your email</p>
            <div className={styles.leftFeatures}>
              <div className={styles.leftFeature}><span>✓</span> Check spam if not received</div>
              <div className={styles.leftFeature}><span>✓</span> Code expires in 10 minutes</div>
              <div className={styles.leftFeature}><span>✓</span> Never share this code</div>
            </div>
          </div>
        </div>
        <div className={styles.rightPanel}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h1>Enter OTP</h1>
              <p>Sent to <strong>{form.email}</strong></p>
            </div>

            <div className={styles.otpGrid} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className={styles.otpBox}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              className={styles.submitBtn}
              onClick={handleVerifyOtp}
              disabled={otpLoading || otp.join('').length < 6}
            >
              {otpLoading ? <span className={styles.spinner} /> : '✅ Verify & Login'}
            </button>

            <div className={styles.resendRow}>
              {resendCooldown > 0
                ? <span className={styles.resendCooldown}>Resend in {resendCooldown}s</span>
                : <button className={styles.resendBtn} onClick={handleResend}>Resend OTP</button>
              }
            </div>

            <p className={styles.switchText}>
              Wrong email?{' '}
              <button className={styles.switchLink} style={{ background:'none',border:'none',cursor:'pointer' }}
                onClick={() => { setStep('credentials'); setOtp(['','','','','','']) }}>
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render credentials step ──────────────────────────────────
  return (
    <div className={styles.authContainer}>
      <div className={styles.leftPanel}>
        <Link to="/" className={styles.backBtn}>← Back to Home</Link>
        <div className={styles.leftContent}>
          <div className={styles.leftLogo}>🏠</div>
          <h2>Property Dekho</h2>
          <p>Your complete rental management solution</p>
          <div className={styles.leftFeatures}>
            <div className={styles.leftFeature}><span>✓</span> Manage Properties</div>
            <div className={styles.leftFeature}><span>✓</span> Track Payments</div>
            <div className={styles.leftFeature}><span>✓</span> Digital Agreements</div>
            <div className={styles.leftFeature}><span>✓</span> Tenant Management</div>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Welcome back</h1>
            <p>Sign in — your role is detected automatically</p>
          </div>

          <div className={styles.roleInfo} style={{ marginBottom: '1.2rem' }}>
            🔐 OTP will be sent to your email to complete login
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>📧</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Send OTP →'}
            </button>
          </form>

          <p className={styles.switchText}>
            Don't have an account?{' '}
            <Link to="/signup" className={styles.switchLink}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
