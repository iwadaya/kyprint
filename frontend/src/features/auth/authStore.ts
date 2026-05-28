import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'PRESS_OPERATOR' | 'DRIVER' | 'SALES' | 'CUSTOMER'
  phone?: string
}

interface AuthState {
  user: User | null
  token: string | null
  currentStaffId: string | null
  setAuth: (user: User, token: string) => void
  setCurrentStaff: (id: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      currentStaffId: null,
      setAuth: (user, token) => set({ user, token, currentStaffId: user.id }),
      setCurrentStaff: id => set({ currentStaffId: id }),
      logout: () => set({ user: null, token: null, currentStaffId: null }),
    }),
    { name: 'printshop_auth' }
  )
)
