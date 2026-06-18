import axios from 'axios'

const API = axios.create({
  baseURL: 'https://property-dekho-becho.onrender.com',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach token to every request if available
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default API
