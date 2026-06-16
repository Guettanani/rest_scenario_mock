import api from './authService'

export const scenarioService = {
  generate: async (topic, customPrompt = '', store = true) => {
    try {
      const response = await api.post('/api/v1/scenario/generate', {
        topic,
        custom_prompt: customPrompt,
        store,
      })
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de la generation du scenario')
    }
  },

  list: async () => {
    try {
      const response = await api.get('/api/v1/scenarios')
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors du chargement des scenarios')
    }
  },

  get: async (scenarioId) => {
    try {
      const response = await api.get(`/api/v1/scenario/${scenarioId}`)
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Scenario introuvable')
    }
  },

  refreshIndex: async () => {
    try {
      const response = await api.post('/api/v1/index/refresh')
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de la reconstruction de l index')
    }
  },

  getDocuments: async () => {
    try {
      const response = await api.get('/api/v1/documents')
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors du chargement des documents')
    }
  },

  healthCheck: async () => {
    try {
      const response = await api.get('/health')
      return response.data
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible.')
      }
      throw new Error(error.response?.data?.detail || 'Health check echoue')
    }
  },
}

export default scenarioService
