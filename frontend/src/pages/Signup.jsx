import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Signup() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const [role, setRole]   = useState(searchParams.get('role') || 'owner')
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirm: '', phone: '' })
  const [loading, setLoading]         = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // OTP step
  const [step, setStep]               = useState('form') // 'form' | 'otp'
  const [otp, setOtp]                 = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading]   = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef([])

  useEffect(() => {
    const r = searchParams.get('role')
    if (r) setRole(r)
  }, [searchParams])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── Step 1: register form ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error('Please fill all fields'); return }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const res = await API.post('/users/register', {
        name:     form.name,
        email:    form.email,
        password: form.password,
        role,
        phone:    form.phone || ''
      })
      if (res.data.needs_otp === false) {
        // OTP table not ready — auto-login directly
        const loginRes = await API.post('/users/login', { email: form.email, password: form.password })
        if (loginRes.data.access_token) {
          login(loginRes.data.access_token, {
            id: loginRes.data.user?.id, email: form.email,
            role: loginRes.data.user?.role || role, name: form.name, phone: form.phone || ''
          })
          toast.success(`Welcome, ${form.name}! 🎉`)
          navigate(role === 'owner' ? '/owner' : '/tenant')
        }
      } else {
        toast.success('Account created! Check your email for OTP 📧')
        setStep('otp')
        setResendCooldown(60)
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: OTP verify ────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
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
      const res = await API.post('/users/verify-signup-otp', { email: form.email, otp: code })
      const userRole = res.data.user?.role || role
      login(res.data.access_token, {
        id:    res.data.user?.id,
        email: form.email,
        role:  userRole,
        name:  form.name,
        phone: form.phone || ''
      })
      toast.success(`Welcome, ${form.name}! 🎉`)
      navigate(userRole === 'owner' ? '/owner' : '/tenant')
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
      await API.post('/users/resend-otp', { email: form.email, purpose: 'signup' })
      toast.success('New OTP sent 📧')
      setOtp(['', '', '', '', '', ''])
      setResendCooldown(60)
      otpRefs.current[0]?.focus()
    } catch {
      toast.error('Failed to resend OTP')
    }
  }

  const getStrength = (pass) => {
    if (!pass) return 0
    let s = 0
    if (pass.length >= 6) s++
    if (/[A-Z]/.test(pass)) s++
    if (/[0-9]/.test(pass)) s++
    if (/[^A-Za-z0-9]/.test(pass)) s++
    return s
  }
  const strength = getStrength(form.password)
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981']

  // ── OTP screen ───────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className={styles.authContainer}>
        <div className={styles.leftPanel}>
          <button onClick={() => setStep('form')} className={styles.backBtn}>← Back</button>
          <div className={styles.leftContent}>
            <div className={styles.leftLogo}>📧</div>
            <h2>Verify Your Email</h2>
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
              {otpLoading ? <span className={styles.spinner} /> : '✅ Verify Email & Continue'}
            </button>

            <div className={styles.resendRow}>
              {resendCooldown > 0
                ? <span className={styles.resendCooldown}>Resend in {resendCooldown}s</span>
                : <button className={styles.resendBtn} onClick={handleResend}>Resend OTP</button>
              }
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────
  return (
    <div className={styles.authContainer}>
      <div className={styles.leftPanel}>
        <Link to="/" className={styles.backBtn}>← Back to Home</Link>
        <div className={styles.leftContent}>
          <div className={styles.leftLogo}>🏠</div>
          <h2>Join Property Dekho</h2>
          <p>Start managing your properties today</p>
          <div className={styles.leftFeatures}>
            <div className={styles.leftFeature}><span>✓</span> Free to get started</div>
            <div className={styles.leftFeature}><span>✓</span> No credit card needed</div>
            <div className={styles.leftFeature}><span>✓</span> Secure & encrypted</div>
            <div className={styles.leftFeature}><span>✓</span> Setup in 2 minutes</div>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Create account</h1>
            <p>Join thousands of users today</p>
          </div>

          <div className={styles.roleToggle}>
            <button className={role === 'owner' ? styles.roleActiveBtn : styles.roleInactiveBtn} onClick={() => setRole('owner')} type="button">👤 Owner</button>
            <button className={role === 'tenant' ? styles.roleActiveBtn : styles.roleInactiveBtn} onClick={() => setRole('tenant')} type="button">🏠 Tenant</button>
          </div>

          <div className={styles.roleInfo}>
            {role === 'owner' ? '🏢 Registering as a Property Owner' : '🏡 Registering as a Tenant'}
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Full Name</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>👤</span>
                <input type="text" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className={styles.field}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>📧</span>
                <input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div className={styles.field}>
              <label>Phone Number {role === 'tenant' ? '' : '(Optional)'}</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>📱</span>
                <input type="tel" placeholder="e.g. 9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required={role === 'tenant'} />
              </div>
            </div>
            <div className={styles.field}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁️'}</button>
              </div>
              {form.password && (
                <div className={styles.strengthBar}>
                  {[1,2,3,4].map(i => (
                    <div key={i} className={styles.strengthSegment} style={{ background: i <= strength ? strengthColors[strength] : '#e2e8f0' }} />
                  ))}
                  <span style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label>Confirm Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required />
              </div>
              {form.confirm && form.password !== form.confirm && <p className={styles.errorText}>Passwords do not match</p>}
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : `Create ${role === 'owner' ? 'Owner' : 'Tenant'} Account`}
            </button>
          </form>

          <p className={styles.switchText}>
            Already have an account?{' '}
            <Link to={`/login?role=${role}`} className={styles.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
