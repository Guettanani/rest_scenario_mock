import api from './authService'

const localVrElements = []
let lastGeneratedMapping = { nodes: [], edges: [] }

export const fileService = {
  uploadSource: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return normalizeSourceFile(response.data)
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de l upload du fichier')
    }
  },

  uploadVrElement: async (file) => {
    const element = {
      id: Date.now(),
      titre: file.name,
      format: (file.name.split('.').pop() || '').toUpperCase(),
      taille: file.size,
      type_element: getVrType(file.name),
      date_ajout: new Date().toISOString(),
    }
    localVrElements.push(element)
    return element
  },

  getSources: async () => {
    try {
      const response = await api.get('/api/v1/documents')
      const payload = response.data
      const docs = Array.isArray(payload?.documents)
        ? payload.documents
        : Array.isArray(payload)
          ? payload
          : []
      return docs.map(normalizeDocumentInfo)
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors du chargement des documents')
    }
  },

  getVrElements: async () => {
    return Promise.resolve(localVrElements)
  },

  deleteSource: async (id) => {
    try {
      await api.delete(`/api/v1/files/${id}`)
      return { success: true }
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de la suppression')
    }
  },

  deleteVrElement: async (id) => {
    const index = localVrElements.findIndex((e) => e.id === id)
    if (index >= 0) {
      localVrElements.splice(index, 1)
    }
    return { success: true }
  },
}

export const mappingService = {
  generateMapping: async (sourceIds, elementIds) => {
    const response = await api.post('/mapping/generate', {
      source_ids: sourceIds || [],
      element_ids: elementIds || [],
    })

    lastGeneratedMapping = {
      nodes: response.data?.nodes || [],
      edges: response.data?.edges || [],
    }
    return lastGeneratedMapping
  },

  saveMapping: async (nodes, edges) => {
    lastGeneratedMapping = { nodes: nodes || [], edges: edges || [] }
    return Promise.resolve({ success: true, message: 'Mapping gardé en session frontend' })
  },

  getMapping: async (scenarioId) => {
    void scenarioId
    return Promise.resolve(lastGeneratedMapping)
  },
}

export const dbModelService = {
  generateDatabaseModel: async (sourceIds, elementIds) => {
    const response = await api.post('/database/update', {
      source_ids: sourceIds || [],
      element_ids: elementIds || [],
    })

    return {
      tables: response.data?.tables || [],
      relationships: response.data?.relationships || [],
      sql_ddl: response.data?.sql_ddl || '',
      stats: response.data?.stats || { source_files: 0, tables: 0, relationships: 0 },
    }
  },

  saveDataReview: async ({ sourceIds, table, rows, deletedIds }) => {
    const response = await api.post('/database/review/save', {
      source_ids: sourceIds || [],
      table: table || 'composant3d',
      rows: rows || [],
      deleted_ids: deletedIds || [],
    })

    return {
      success: Boolean(response.data?.success),
      message: response.data?.message || 'Modifications enregistrées.',
      table: response.data?.table || 'composant3d',
      stats: response.data?.stats || { created: 0, updated: 0, deleted: 0 },
      rows: response.data?.rows || [],
    }
  },
}

export const generationService = {
  getLibrary: async ({ limit = 20, offset = 0 } = {}) => {
    try {
      const response = await api.get('/api/v1/scenarios', {
        params: { limit, offset },
      })
      const payload = response.data
      const scenarios = Array.isArray(payload?.scenarios) ? payload.scenarios : []
      const items = scenarios.map((s) => ({
        scenario_id: s.scenario_id,
        generation_id: s.scenario_id,
        titre: s.titre || s.topic || 'Scenario sans titre',
        description: s.topic || '',
        created_at: s.created_at,
        updated_at: s.updated_at,
        scenario: {
          titre: s.titre || s.topic,
          etapes: [],
        },
        status: 'generated',
        usage: { model: '-', total_tokens: 0 },
        quality: { score: null },
      }))

      return {
        items,
        total: Number(payload?.total || items.length),
        limit: Number(limit),
        offset: Number(offset),
      }
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible. Verifiez que l API est demarree.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors du chargement de la bibliotheque')
    }
  },

  deleteScenario: async (scenarioId) => {
    try {
      await api.delete(`/api/v1/scenario/${scenarioId}`)
      return { success: true }
    } catch (error) {
      if (!error.response) {
        throw new Error('Service backend inaccessible.')
      }
      throw new Error(error.response?.data?.detail || 'Erreur lors de la suppression')
    }
  },

  getTokenMonitoring: async ({ limit = 50 } = {}) => {
    void limit
    return {
      totals: {
        requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        avg_latency_ms: 0,
      },
      by_model: [],
      recent: [],
    }
  },
}

export const componentCatalogService = {
  getAvailable: async () => {
    return {
      components: [],
      total: 0,
    }
  },

  saveCatalog: async ({ rows, deletedIds }) => {
    void rows
    void deletedIds
    return {
      success: true,
      components: [],
      deletedIds: [],
    }
  },
}

const dataService = {
  fileService,
  mappingService,
  dbModelService,
  generationService,
  componentCatalogService,
}

export default dataService

function normalizeSourceFile(file) {
  return {
    id: file.ID_fichier,
    titre: file.titre,
    format: file.format,
    taille: file.taille,
    source: file.source,
    date_ajout: file.date_ajout,
    type_contenu: file.type_contenu || getFileType(file.titre || ''),
    statut: file.statut,
    erreur: file.erreur,
  }
}

function normalizeDocumentInfo(doc) {
  return {
    id: doc.filename || doc.path || '',
    titre: doc.filename || '',
    format: (doc.extension || '').replace('.', '').toUpperCase(),
    taille: doc.size_bytes || 0,
    source: doc.path || '',
    date_ajout: new Date().toISOString(),
    type_contenu: getFileType(doc.filename || ''),
    statut: 'processed',
    erreur: null,
  }
}

// Helpers
function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'csv'].includes(ext)) return 'document'
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) return 'video'
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return 'image'
  return 'autre'
}

function getVrType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (['fbx', 'obj', '3ds'].includes(ext)) return 'modele_3d'
  if (['prefab'].includes(ext)) return 'prefab'
  if (['cs'].includes(ext)) return 'script'
  if (['mat'].includes(ext)) return 'material'
  if (['png', 'jpg', 'tga'].includes(ext)) return 'texture'
  return 'autre'
}
