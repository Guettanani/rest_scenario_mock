import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { adminService } from '../services/authService'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Key,
  AlertCircle,
  Check,
  X,
  GraduationCap,
  BookOpen,
  Cloud,
  Database,
  Save,
  RefreshCw
} from 'lucide-react'

const ROLES = {
  admin: {
    label: 'Administrateur',
    icon: ShieldCheck,
    badgeClass: 'bg-primary-100 text-primary-800 border border-primary-300',
  },
  formateur: {
    label: 'Formateur',
    icon: BookOpen,
    badgeClass: 'bg-gray-100 text-gray-800 border border-gray-300',
  },
  apprenant: {
    label: 'Apprenant',
    icon: GraduationCap,
    badgeClass: 'bg-gray-50 text-gray-700 border border-gray-300',
  },
}

function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showCompetencesModal, setShowCompetencesModal] = useState(false)
  const [llmSettings, setLlmSettings] = useState({
    provider: 'api',
    api_base_url: 'https://api.openai.com/v1/chat/completions',
    api_model: 'gpt-4o-mini',
    api_key: '',
    api_key_set: false,
    api_key_preview: '',
  })
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmSaving, setLlmSaving] = useState(false)
  const [embeddingSettings, setEmbeddingSettings] = useState({
    provider: 'api',
    api_base_url: 'https://api.openai.com/v1/embeddings',
    api_model: 'text-embedding-3-small',
    dimension: 1536,
    api_key: '',
    api_key_set: false,
    api_key_preview: '',
  })
  const [embeddingLoading, setEmbeddingLoading] = useState(true)
  const [embeddingSaving, setEmbeddingSaving] = useState(false)

  // Form state for creating user
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: 'apprenant',
  })

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (roleFilter) params.role = roleFilter
      const data = await adminService.getUsers(params)
      setUsers(data.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const loadLlmSettings = useCallback(async () => {
    try {
      setLlmLoading(true)
      const data = await adminService.getLlmSettings()
      setLlmSettings({
        provider: 'api',
        api_base_url: data.api_base_url || 'https://api.openai.com/v1/chat/completions',
        api_model: data.api_model || 'gpt-4o-mini',
        api_key: '',
        api_key_set: Boolean(data.api_key_set),
        api_key_preview: data.api_key_preview || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLlmLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLlmSettings()
  }, [loadLlmSettings])

  const loadEmbeddingSettings = useCallback(async () => {
    try {
      setEmbeddingLoading(true)
      const data = await adminService.getEmbeddingSettings()
      setEmbeddingSettings({
        provider: 'api',
        api_base_url: data.api_base_url || 'https://api.openai.com/v1/embeddings',
        api_model: data.api_model || 'text-embedding-3-small',
        dimension: Number(data.dimension || 1536),
        api_key: '',
        api_key_set: Boolean(data.api_key_set),
        api_key_preview: data.api_key_preview || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setEmbeddingLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmbeddingSettings()
  }, [loadEmbeddingSettings])

  const handleSaveLlmSettings = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLlmSaving(true)
    try {
      const payload = {
        provider: 'api',
        api_base_url: llmSettings.api_base_url,
        api_model: llmSettings.api_model,
      }
      if (llmSettings.api_key.trim()) {
        payload.api_key = llmSettings.api_key.trim()
      }

      const data = await adminService.updateLlmSettings(payload)
      setLlmSettings((previous) => ({
        ...previous,
        provider: 'api',
        api_base_url: data.api_base_url || previous.api_base_url,
        api_model: data.api_model || previous.api_model,
        api_key: '',
        api_key_set: Boolean(data.api_key_set),
        api_key_preview: data.api_key_preview || '',
      }))
      setSuccess('Configuration LLM sauvegardee')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLlmSaving(false)
    }
  }

  const handleSaveEmbeddingSettings = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setEmbeddingSaving(true)
    try {
      const payload = {
        provider: 'api',
        api_base_url: embeddingSettings.api_base_url,
        api_model: embeddingSettings.api_model,
        dimension: Number(embeddingSettings.dimension || 1536),
      }
      if (embeddingSettings.api_key.trim()) {
        payload.api_key = embeddingSettings.api_key.trim()
      }

      const data = await adminService.updateEmbeddingSettings(payload)
      setEmbeddingSettings((previous) => ({
        ...previous,
        provider: 'api',
        api_base_url: data.api_base_url || previous.api_base_url,
        api_model: data.api_model || previous.api_model,
        dimension: Number(data.dimension || previous.dimension),
        api_key: '',
        api_key_set: Boolean(data.api_key_set),
        api_key_preview: data.api_key_preview || '',
      }))
      setSuccess('Configuration embeddings sauvegardee')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEmbeddingSaving(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await adminService.createUser(newUser)
      setSuccess('Utilisateur créé avec succès')
      setShowCreateModal(false)
      setNewUser({ nom: '', prenom: '', email: '', password: '', role: 'apprenant' })
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await adminService.updateUserStatus(userId, !currentStatus)
      setSuccess(`Utilisateur ${currentStatus ? 'désactivé' : 'activé'} avec succès`)
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return
    try {
      await adminService.deleteUser(userId)
      setSuccess('Utilisateur supprimé')
      loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleResetPassword = async (userId) => {
    const newPassword = window.prompt('Nouveau mot de passe (min 6 caractères):')
    if (!newPassword || newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    try {
      await adminService.resetPassword(userId, newPassword)
      setSuccess('Mot de passe réinitialisé')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase()
    return (
      u.nom?.toLowerCase().includes(searchLower) ||
      u.prenom?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower)
    )
  })

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-red-50 rounded-lg">
          <ShieldOff className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700">Accès refusé</h2>
          <p className="text-red-600 mt-2">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto page-shell tech-grid-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 p-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-primary-600" />
            Gestion des utilisateurs
          </h1>
          <p className="section-caption mt-1">Gérez les comptes et les rôles des utilisateurs</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="h-5 w-5" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}

      {/* LLM Settings */}
      <form onSubmit={handleSaveLlmSettings} className="panel-surface mb-6 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary-600" />
              Moteur IA des scenarios
            </h2>
            <p className="section-caption mt-1">
              Configurez le LLM en ligne utilise pour la generation de scenarios. Le RAG reste actif.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLlmSettings}
            className="btn-secondary flex items-center gap-2"
            disabled={llmLoading || llmSaving}
          >
            <RefreshCw className={`h-4 w-4 ${llmLoading ? 'animate-spin' : ''}`} />
            Recharger
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">URL API chat completions</label>
            <input
              type="text"
              value={llmSettings.api_base_url}
              onChange={(e) => setLlmSettings({ ...llmSettings, api_base_url: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Modele API</label>
            <input
              type="text"
              value={llmSettings.api_model}
              onChange={(e) => setLlmSettings({ ...llmSettings, api_model: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">
              Cle API {llmSettings.api_key_set && llmSettings.api_key_preview ? `(${llmSettings.api_key_preview})` : ''}
            </label>
            <input
              type="password"
              value={llmSettings.api_key}
              onChange={(e) => setLlmSettings({ ...llmSettings, api_key: e.target.value })}
              className="input-field w-full"
              placeholder={llmSettings.api_key_set ? 'Laisser vide pour conserver la cle actuelle' : 'sk-...'}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-5">
          <p className="text-sm text-gray-500">
            Actif: API en ligne ({llmSettings.api_model})
          </p>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={llmSaving || llmLoading}>
            <Save className="h-4 w-4" />
            {llmSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>

      {/* Embedding Settings */}
      <form onSubmit={handleSaveEmbeddingSettings} className="panel-surface mb-6 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary-600" />
              Fournisseur d'embeddings
            </h2>
            <p className="section-caption mt-1">
              Configurez l'API utilisee pour vectoriser les documents du RAG. Aucun moteur RAG local n'est lance dans Scenia.
            </p>
          </div>
          <button
            type="button"
            onClick={loadEmbeddingSettings}
            className="btn-secondary flex items-center gap-2"
            disabled={embeddingLoading || embeddingSaving}
          >
            <RefreshCw className={`h-4 w-4 ${embeddingLoading ? 'animate-spin' : ''}`} />
            Recharger
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Provider</label>
            <input
              type="text"
              value="API embeddings compatible"
              className="input-field w-full"
              disabled
            />
          </div>
          <div>
            <label className="form-label">Dimension des vecteurs</label>
            <input
              type="number"
              min="1"
              max="32768"
              value={embeddingSettings.dimension}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, dimension: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="form-label">Modele d'embedding</label>
            <input
              type="text"
              value={embeddingSettings.api_model}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, api_model: e.target.value })}
              className="input-field w-full"
              placeholder="text-embedding-3-small"
            />
          </div>
          <div>
            <label className="form-label">URL API embeddings</label>
            <input
              type="text"
              value={embeddingSettings.api_base_url}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, api_base_url: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">
              Cle API RAG {embeddingSettings.api_key_set && embeddingSettings.api_key_preview ? `(${embeddingSettings.api_key_preview})` : ''}
            </label>
            <input
              type="password"
              value={embeddingSettings.api_key}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, api_key: e.target.value })}
              className="input-field w-full"
              placeholder={embeddingSettings.api_key_set ? 'Laisser vide pour conserver la cle actuelle' : 'Cle API du fournisseur embeddings'}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-5">
          <p className="text-sm text-gray-500">
            Actif: API ({embeddingSettings.api_model}, {embeddingSettings.dimension} dimensions)
          </p>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={embeddingSaving || embeddingLoading}>
            <Save className="h-4 w-4" />
            {embeddingSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-field pl-10 pr-8"
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Administrateurs</option>
            <option value="formateur">Formateurs</option>
            <option value="apprenant">Apprenants</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="panel-surface overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Chargement...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun utilisateur trouvé
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Utilisateur</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Rôle</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Inscription</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Dernière connexion</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => {
                const roleInfo = ROLES[u.role] || ROLES.apprenant
                const RoleIcon = roleInfo.icon
                return (
                  <tr key={u.ID_utilisateur} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-medium">
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.prenom} {u.nom}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${roleInfo.badgeClass}`}>
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        u.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {u.is_active ? (
                          <>
                            <Check className="h-3 w-3" />
                            Actif
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            Inactif
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.date_inscription ? new Date(u.date_inscription).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {u.role === 'apprenant' && (
                          <button
                            onClick={() => {
                              setSelectedUser(u)
                              setShowCompetencesModal(true)
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                            title="Compétences"
                          >
                            <GraduationCap className="h-4 w-4" />
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u.ID_utilisateur, u.is_active)}
                              className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
                              title={u.is_active ? 'Désactiver' : 'Activer'}
                            >
                              {u.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleResetPassword(u.ID_utilisateur)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Réinitialiser mot de passe"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.ID_utilisateur)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-600" />
              Créer un utilisateur
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nom</label>
                  <input
                    type="text"
                    required
                    value={newUser.nom}
                    onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="form-label">Prénom</label>
                  <input
                    type="text"
                    required
                    value={newUser.prenom}
                    onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">Rôle</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="apprenant">Apprenant</option>
                  <option value="formateur">Formateur</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Competences Modal */}
      {showCompetencesModal && selectedUser && (
        <CompetencesModal
          user={selectedUser}
          onClose={() => {
            setShowCompetencesModal(false)
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}

// Competences Modal Component
function CompetencesModal({ user, onClose }) {
  const [competences, setCompetences] = useState([])
  const [userCompetences, setUserCompetences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [allCompetences, userComps] = await Promise.all([
        adminService.getCompetences(),
        adminService.getUserCompetences(user.ID_utilisateur),
      ])
      setCompetences(allCompetences)
      setUserCompetences(userComps)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.ID_utilisateur])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateLevel = async (competenceId, niveau) => {
    try {
      await adminService.updateUserCompetence(user.ID_utilisateur, competenceId, { niveau })
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAssignCompetence = async (competenceId) => {
    try {
      await adminService.assignCompetence(user.ID_utilisateur, {
        ID_utilisateur: user.ID_utilisateur,
        ID_competence: competenceId,
        niveau: 'débutant',
      })
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary-600" />
            Compétences de {user.prenom} {user.nom}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {userCompetences.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune compétence assignée</p>
            ) : (
              userCompetences.map((uc) => (
                <div key={uc.ID_competence_utilisateur} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{uc.competence?.titre}</p>
                      <p className="text-sm text-gray-500">{uc.competence?.description}</p>
                    </div>
                    <select
                      value={uc.niveau}
                      onChange={(e) => handleUpdateLevel(uc.ID_competence, e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="débutant">Débutant</option>
                      <option value="intermédiaire">Intermédiaire</option>
                      <option value="avancé">Avancé</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  {uc.score !== null && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${uc.score}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{uc.score}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Available competences to assign */}
            {competences.filter(c => !userCompetences.find(uc => uc.ID_competence === c.ID_competence)).length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Ajouter une compétence</h3>
                <div className="flex flex-wrap gap-2">
                  {competences
                    .filter(c => !userCompetences.find(uc => uc.ID_competence === c.ID_competence))
                    .map(c => (
                      <button
                        key={c.ID_competence}
                        onClick={() => handleAssignCompetence(c.ID_competence)}
                        className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm hover:bg-primary-100"
                      >
                        + {c.titre}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminPage
