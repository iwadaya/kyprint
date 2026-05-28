import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 15000,
})

// Attach JWT to every request
api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('printshop_auth')
    if (stored) {
      const { token } = JSON.parse(stored)
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } catch {}
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('printshop_auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
