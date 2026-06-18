import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [ready, setReady]     = useState(false)   // ← NEW: true once localStorage is read

  useEffect(() => {
    const savedToken = localStorage.getItem('pd_token')
    const savedUser  = localStorage.getItem('pd_user')
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('pd_token')
        localStorage.removeItem('pd_user')
      }
    }
    setReady(true)   // always mark ready after attempting restore
  }, [])

  const login = (tokenValue, userData) => {
    localStorage.setItem('pd_token', tokenValue)
    localStorage.setItem('pd_user', JSON.stringify(userData))
    setToken(tokenValue)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('pd_token')
    localStorage.removeItem('pd_user')
    localStorage.removeItem('pd_cart')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
