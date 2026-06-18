import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [role, setRole] = useState('owner')
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill all fields')
      return
    }
    setLoading(true)
    try {
      const res = await API.post('/users/login', {
        email: form.email,
        password: form.password
      })

      if (res.data.access_token) {
        login(res.data.access_token, {
          id: res.data.user?.id,
          email: form.email,
          role: role,
          name: res.data.user?.name || form.email.split('@')[0]
        })
        toast.success(`Welcome back! 👋`)
        navigate(role === 'owner' ? '/owner' : '/tenant')
      } else {
        toast.error(String(res.data.error || 'Invalid credentials'))
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.authContainer}>
      {/* Left Panel */}
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

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Welcome back</h1>
            <p>Sign in to your account</p>
          </div>

          {/* Role Toggle */}
          <div className={styles.roleToggle}>
            <button
              className={role === 'owner' ? styles.roleActiveBtn : styles.roleInactiveBtn}
              onClick={() => setRole('owner')}
              type="button"
            >
              👤 Owner
            </button>
            <button
              className={role === 'tenant' ? styles.roleActiveBtn : styles.roleInactiveBtn}
              onClick={() => setRole('tenant')}
              type="button"
            >
              🏠 Tenant
            </button>
          </div>

          <div className={styles.roleInfo}>
            {role === 'owner'
              ? '🏢 Signing in as a Property Owner'
              : '🏡 Signing in as a Tenant'}
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
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : `Sign In as ${role === 'owner' ? 'Owner' : 'Tenant'}`}
            </button>
          </form>

          <p className={styles.switchText}>
            Don't have an account?{' '}
            <Link to={`/signup?role=${role}`} className={styles.switchLink}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
