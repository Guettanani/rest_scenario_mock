import axios from 'axios'
import { APP_ROUTES, isAuthPagePath } from '../routes/paths'
import { API_URL } from './env'

// Configuration Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scenia_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '')
      const isAuthRequest =
        requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register')
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      const isAuthPage = isAuthPagePath(currentPath)

      localStorage.removeItem('scenia_user')
      localStorage.removeItem('scenia_token')

      // Keep login/register flows on-page so form errors remain visible to the user.
      if (!isAuthRequest && !isAuthPage && typeof window !== 'undefined') {
        window.location.href = APP_ROUTES.login
      }
    }
    return Promise.reject(error)
  }
)

export const authService = {
  // Inscription publique (apprenant)
  register: async ({ nom, prenom, email, password, role = 'apprenant' }) => {
    try {
      const response = await api.post('/auth/register/public', {
        nom,
        prenom,
        email,
        password,
        role,
      })
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de l inscription')
    }
  },

  // Connexion
  login: async (email, password) => {
    try {
      // OAuth2 attend username et password en form-data
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)
      
      const tokenResponse = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      
      const token = tokenResponse.data.access_token
      
      // Stocker le token temporairement pour récupérer les infos utilisateur
      localStorage.setItem('scenia_token', token)
      
      // Récupérer les infos de l'utilisateur
      const userResponse = await api.get('/auth/me')
      const user = userResponse.data
      
      return {
        user: {
          id: user.ID_utilisateur,
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
          is_active: user.is_active,
          date_inscription: user.date_inscription,
          derniere_connexion: user.derniere_connexion,
        },
        token,
      }
    } catch (error) {
      const detail = error.response?.data?.detail
      const detailMessage = Array.isArray(detail)
        ? detail.map((item) => item?.msg || JSON.stringify(item)).join(' | ')
        : typeof detail === 'string'
          ? detail
          : ''

      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(detailMessage || 'Email ou mot de passe invalide')
    }
  },

  // Récupérer l'utilisateur courant
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me')
      const user = response.data
      return {
        id: user.ID_utilisateur,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        is_active: user.is_active,
        date_inscription: user.date_inscription,
        derniere_connexion: user.derniere_connexion,
      }
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur de recuperation utilisateur')
    }
  },

  // Mise à jour profil
  updateProfile: async (userData) => {
    try {
      const response = await api.put('/auth/me', userData)
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur de mise a jour')
    }
  },
}

// Service Admin pour la gestion des utilisateurs
export const adminService = {
  // Lister tous les utilisateurs
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/admin/users', { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de récupération des utilisateurs')
    }
  },

  // Récupérer un utilisateur
  getUser: async (userId) => {
    try {
      const response = await api.get(`/admin/users/${userId}`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Utilisateur non trouvé')
    }
  },

  // Créer un utilisateur
  createUser: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de création utilisateur')
    }
  },

  // Mettre à jour un utilisateur
  updateUser: async (userId, userData) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, userData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de mise à jour')
    }
  },

  // Changer le rôle
  updateUserRole: async (userId, role) => {
    try {
      const response = await api.put(`/admin/users/${userId}/role`, { role })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de changement de rôle')
    }
  },

  // Activer/Désactiver un utilisateur
  updateUserStatus: async (userId, isActive) => {
    try {
      const response = await api.put(`/admin/users/${userId}/status`, { is_active: isActive })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de changement de statut')
    }
  },

  // Supprimer un utilisateur
  deleteUser: async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`)
      return true
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de suppression')
    }
  },

  // Réinitialiser le mot de passe
  resetPassword: async (userId, newPassword) => {
    try {
      const response = await api.post(`/admin/users/${userId}/reset-password`, null, {
        params: { new_password: newPassword }
      })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de réinitialisation')
    }
  },

  // Compétences
  getCompetences: async (scenarioId = null) => {
    try {
      const params = scenarioId ? { scenario_id: scenarioId } : {}
      const response = await api.get('/admin/competences', { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de récupération des compétences')
    }
  },

  createCompetence: async (competenceData) => {
    try {
      const response = await api.post('/admin/competences', competenceData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de création compétence')
    }
  },

  // Compétences utilisateur
  getUserCompetences: async (userId) => {
    try {
      const response = await api.get(`/admin/users/${userId}/competences`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de récupération des compétences')
    }
  },

  assignCompetence: async (userId, competenceData) => {
    try {
      const response = await api.post(`/admin/users/${userId}/competences`, competenceData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur d\'assignation compétence')
    }
  },

  updateUserCompetence: async (userId, competenceId, data) => {
    try {
      const response = await api.put(`/admin/users/${userId}/competences/${competenceId}`, data)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de mise à jour compétence')
    }
  },

  getRuntimeConfigHistory: async (params = {}) => {
    try {
      const response = await api.get('/config/history', { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de récupération de l\'audit runtime')
    }
  },
  getLlmSettings: async () => {
    try {
      const response = await api.get('/admin/llm-settings')
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de recuperation de la configuration LLM')
    }
  },

  updateLlmSettings: async (settings) => {
    try {
      const response = await api.put('/admin/llm-settings', settings)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de sauvegarde de la configuration LLM')
    }
  },

  getEmbeddingSettings: async () => {
    try {
      const response = await api.get('/admin/embedding-settings')
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de recuperation de la configuration embeddings')
    }
  },

  updateEmbeddingSettings: async (settings) => {
    try {
      const response = await api.put('/admin/embedding-settings', settings)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Erreur de sauvegarde de la configuration embeddings')
    }
  },
}

export default api
