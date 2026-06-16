import { createContext, useCallback, useContext, useState, useEffect } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('scenia_user')
    localStorage.removeItem('scenia_token')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getCurrentUser()
      localStorage.setItem('scenia_user', JSON.stringify(userData))
      setUser(userData)
    } catch (error) {
      // Token might be invalid, logout
      logout()
    }
  }, [logout])

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté
    const storedUser = localStorage.getItem('scenia_user')
    const token = localStorage.getItem('scenia_token')
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
      // Optionally refresh user data from server
      refreshUser()
    }
    setLoading(false)
  }, [refreshUser])

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password)
      const { user: userData, token } = response
      
      localStorage.setItem('scenia_user', JSON.stringify(userData))
      localStorage.setItem('scenia_token', token)
      setUser(userData)
      
      return { success: true, user: userData }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const register = async ({ nom, prenom, email, password }) => {
    try {
      await authService.register({ nom, prenom, email, password })
      // Auto-login after successful registration for smoother UX.
      const loginResult = await login(email, password)
      if (!loginResult.success) {
        return { success: true }
      }
      return { success: true, user: loginResult.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const updateUser = (updatedData) => {
    const updatedUser = { ...user, ...updatedData }
    localStorage.setItem('scenia_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  // Helper to check roles
  const isAdmin = () => user?.role === 'admin'
  const isFormateur = () => user?.role === 'formateur'
  const isApprenant = () => user?.role === 'apprenant'
  const hasRole = (role) => user?.role === role
  const hasAnyRole = (roles) => roles.includes(user?.role)

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register,
      logout, 
      updateUser, 
      loading,
      isAdmin,
      isFormateur,
      isApprenant,
      hasRole,
      hasAnyRole,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
