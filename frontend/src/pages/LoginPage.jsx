import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'
import { APP_ROUTES } from '../routes/paths'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    setError('')

    const result = await login(data.email.trim(), data.password)

    if (result.success) {
      navigate(result.user?.role === 'apprenant' ? APP_ROUTES.apprenant : APP_ROUTES.dashboard)
    } else {
      setError(result.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 tech-grid-background page-enter">
      <Link
        to={APP_ROUTES.home}
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour a l accueil
      </Link>

      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scen-IA</h1>
          <p className="text-gray-500 mt-2 text-sm">Generateur de Scenarios VR</p>
        </div>

        {/* Form card */}
        <div className="page-shell p-8 relative">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion</h2>
          <p className="text-gray-500 mb-6">Bienvenue ! Connectez-vous a votre compte.</p>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
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

            {/* Password */}
            <div>
              <label className="form-label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Le mot de passe est requis',
                    minLength: {
                      value: 6,
                      message: 'Le mot de passe doit contenir au moins 6 caracteres',
                    },
                  })}
                  className="input-field pr-12"
                  placeholder="..."
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-gray-600">
            Pas encore de compte ?{' '}
            <Link to={APP_ROUTES.register} className="text-red-600 hover:text-red-700 font-medium">
              Creer un compte
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-gray-500 text-sm">
          Utilisez un compte existant ou creez un compte depuis la page d inscription.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
