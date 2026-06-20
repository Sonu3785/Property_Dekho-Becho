import axios from 'axios'

const BASE_URL = 'https://property-dekho-becho.onrender.com'

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach token to every request if available
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('pd_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Pre-warm the backend as soon as this module loads.
// Fires a silent ping to /health so the server is awake
// by the time the user clicks Login or the dashboard fetches data.
axios.get(`${BASE_URL}/health`).catch(() => {})

export default API
