import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, Shield, Calendar, Settings } from 'lucide-react'

function UserProfilePage() {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        nom: user.nom || '',
        prenom: user.prenom || '',
        email: user.email || '',
      })
    }
  }, [user])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = () => {
    // TODO: connecter a l API backend pour sauvegarder
    setIsEditing(false)
  }

  return (
    <div className="tech-grid-background min-h-screen p-2 page-enter">
      <div className="max-w-2xl mx-auto">
        {/* Avatar + infos principales */}
        <div className="panel-surface p-6 mb-6 flex items-center space-x-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <User className="h-10 w-10 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {user?.prenom} {user?.nom}
            </h2>
            <p className="text-gray-500">{user?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-[#e63641]/10 text-[#e63641] text-sm rounded-full font-medium border border-[#e63641]/30">
              {user?.role || 'Utilisateur'}
            </span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="panel-surface p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Settings className="h-5 w-5 text-red-600" />
              <span>Informations personnelles</span>
            </h3>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="btn-primary px-4 py-2 text-sm"
            >
              {isEditing ? 'Sauvegarder' : 'Modifier'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Nom */}
            <div>
              <label className="form-label">Nom</label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            {/* Prenom */}
            <div>
              <label className="form-label">Prenom</label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="form-label">Adresse email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Infos compte */}
        <div className="panel-surface p-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2 mb-4">
            <Shield className="h-5 w-5 text-red-600" />
            <span>Informations du compte</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600 flex items-center space-x-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span>Role</span>
              </span>
              <span className="text-sm font-medium text-gray-900">{user?.role || 'Utilisateur'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600 flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>Membre depuis</span>
              </span>
              <span className="text-sm font-medium text-gray-900">
                {user?.date_creation
                  ? new Date(user.date_creation).toLocaleDateString('fr-FR')
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default UserProfilePage
