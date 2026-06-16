
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { AlertCircle, ArrowLeft, BookOpen, GraduationCap, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { APP_ROUTES } from '../routes/paths'

function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nom: '',
      prenom: '',
      email: '',
      password: '',
      role: 'apprenant',
    },
  })

  const selectedRole = watch('role')

  const onSubmit = async (formData) => {
    setIsLoading(true)
    setError('')

    const result = await registerUser({
      nom: formData.nom.trim(),
      prenom: formData.prenom.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
    })

    if (result.success) {
      navigate(formData.role === 'apprenant' ? APP_ROUTES.apprenant : APP_ROUTES.dashboard)
    } else {
      setError(result.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 tech-grid-background page-enter">
      <div className="w-full max-w-2xl">
        {/* Retour a l accueil */}
        <div className="mb-6">
          <Link
            to={APP_ROUTES.home}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a l accueil
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scen-IA</h1>
          <p className="text-gray-500 mt-2 text-sm">Création de compte apprenant ou formateur</p>
        </div>

        {/* Info card */}
        <div className="page-shell p-8 relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#e63641]/10 border border-[#e63641]/30 mb-4">
              <ShieldCheck className="h-8 w-8 text-[#e63641]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Créer un compte</h2>
            <p className="text-gray-500 mb-6">
              Vous pouvez créer un compte apprenant ou formateur depuis cette interface.
            </p>
          </div>

          {error && (
            <div className="mt-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="form-label">Nom</label>
              <input
                type="text"
                {...register('nom', { required: 'Le nom est requis' })}
                className="input-field"
                placeholder="Dupont"
              />
              {errors.nom && <p className="error-message">{errors.nom.message}</p>}
            </div>

            <div>
              <label className="form-label">Prénom</label>
              <input
                type="text"
                {...register('prenom', { required: 'Le prénom est requis' })}
                className="input-field"
                placeholder="Marie"
              />
              {errors.prenom && <p className="error-message">{errors.prenom.message}</p>}
            </div>

            <div className="lg:col-span-2">
              <label className="form-label">Adresse email</label>
              <input
                type="email"
                {...register('email', {
                  required: "L'email est requis",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Adresse email invalide',
                  },
                })}
                className="input-field"
                placeholder="email@domaine.fr"
              />
              {errors.email && <p className="error-message">{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                {...register('password', {
                  required: 'Le mot de passe est requis',
                  minLength: {
                    value: 6,
                    message: 'Le mot de passe doit contenir au moins 6 caractères',
                  },
                })}
                className="input-field"
                placeholder="••••••••"
              />
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>

            <div>
              <label className="form-label">Rôle</label>
              <select {...register('role')} className="input-field">
                <option value="apprenant">Apprenant</option>
                <option value="formateur">Formateur</option>
              </select>
              <div className="mt-3 rounded-lg border border-black/10 bg-white/60 p-3 text-sm text-black/60 flex items-start gap-2">
                {selectedRole === 'formateur' ? (
                  <BookOpen className="mt-0.5 h-4 w-4 text-[#e63641]" />
                ) : (
                  <GraduationCap className="mt-0.5 h-4 w-4 text-[#e63641]" />
                )}
                <span>
                  {selectedRole === 'formateur'
                    ? 'Le compte formateur pourra accéder au dashboard de génération et d affectation.'
                    : 'Le compte apprenant sera orienté vers son espace de consultation des formations.'}
                </span>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-3 pt-2">
              <button type="submit" disabled={isLoading} className="btn-primary py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : null}
                <span>Créer mon compte</span>
              </button>

              <Link
                to={APP_ROUTES.login}
                className="w-full btn-secondary py-3 flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Retour à la connexion</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
