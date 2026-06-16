import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckCircle2, Clock3, GraduationCap, ListChecks, Loader2, QrCode, Search } from 'lucide-react'
import Modal from '../components/Modal'
import QrCodeLoader from '../components/QrCodeLoader'
import { useAuth } from '../context/AuthContext'
import { APP_ROUTES } from '../routes/paths'
import api from '../services/authService'

const DONE_STATUSES = new Set(['done', 'completed', 'complete', 'finished', 'termine'])

function isCompletedStatus(status) {
  return DONE_STATUSES.has(String(status || '').toLowerCase())
}

function formatDate(value) {
  if (!value) return 'Date non disponible'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function resolveAccessUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  try {
    return new URL(pathOrUrl, window.location.origin).toString()
  } catch {
    return pathOrUrl
  }
}

function ApprenantPage() {
  const { user, isApprenant } = useAuth()
  const isLearner = isApprenant()
  const [assignments, setAssignments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadAssignments() {
      try {
        setIsLoading(true)
        setError('')
        const response = await api.get('/api/v1/assignments/me')
        if (isMounted) {
          const items = Array.isArray(response.data) ? response.data : []
          setAssignments(
            items.map((assignment) => ({
              ...assignment,
              qr_url: resolveAccessUrl(assignment.qr_url),
              config_url: resolveAccessUrl(assignment.config_url),
            })),
          )
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.detail || 'Impossible de charger vos formations assignees.')
          setAssignments([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (isLearner) {
      loadAssignments()
    }

    return () => {
      isMounted = false
    }
  }, [isLearner])

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return assignments

    return assignments.filter((assignment) => {
      const title = assignment.title || ''
      const description = assignment.description || ''
      return `${title} ${description}`.toLowerCase().includes(normalizedSearch)
    })
  }, [assignments, searchTerm])

  const pendingAssignments = filteredAssignments.filter((assignment) => !isCompletedStatus(assignment.status))
  const completedAssignments = filteredAssignments.filter((assignment) => isCompletedStatus(assignment.status))

  if (!isLearner) {
    return <Navigate to={APP_ROUTES.dashboard} replace />
  }

  const renderAssignmentCard = (assignment) => (
    <button
      key={assignment.session_id}
      type="button"
      className="w-full rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm transition hover:border-[#e63641]/40 hover:shadow-md"
      onClick={() => setSelectedAssignment(assignment)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-black">{assignment.title || 'Scenario assigne'}</h3>
          {assignment.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-black/55">{assignment.description}</p>
          )}
        </div>
        <QrCode className="h-5 w-5 shrink-0 text-[#e63641]" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-black/45">
        <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-1">
          {isCompletedStatus(assignment.status) ? 'Realisee' : 'A realiser'}
        </span>
        <span>{formatDate(assignment.assigned_at)}</span>
      </div>
    </button>
  )

  return (
    <section className="page-enter space-y-5">
      <header className="panel-surface relative overflow-hidden border border-black/10 p-6 lg:p-7">
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e63641]/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#e63641]">
              <GraduationCap className="h-4 w-4" />
              Portail apprenant
            </div>
            <h1 className="mt-4 text-3xl lg:text-4xl font-display text-black">
              Bonjour {user?.prenom || 'apprenant'},
              <span className="block text-black/70">vos formations assignees sont pretes.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm lg:text-base text-black/60 leading-relaxed">
              Ouvrez une formation pour afficher son QR code et le session-id a utiliser avec le casque.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-black/10 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-black/45">A realiser</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-3xl font-display text-black">{pendingAssignments.length}</p>
                <Clock3 className="h-6 w-6 text-[#e63641]" />
              </div>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-black/45">Deja realisees</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-3xl font-display text-black">{completedAssignments.length}</p>
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="panel-surface border border-black/10 p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-display inline-flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-[#e63641]" />
              Mes formations
            </h2>
            <p className="mt-1 text-sm text-black/50">Formations assignees par votre formateur ou administrateur.</p>
          </div>

          <label className="relative w-full sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Rechercher une formation"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center justify-center rounded-lg border border-dashed border-black/15 bg-white/70 p-8 text-sm text-black/55">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Chargement des formations...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-black/15 bg-white/70 p-8 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-black/30" />
            <h3 className="mt-4 text-lg font-semibold text-black">Aucune formation assignee</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/55">
              Des qu'un scenario sera associe a votre compte, il apparaitra ici avec son QR code de session.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-base">A realiser</h3>
                <span className="text-xs uppercase tracking-[0.18em] text-black/40">{pendingAssignments.length}</span>
              </div>
              <div className="space-y-3">
                {pendingAssignments.length > 0 ? (
                  pendingAssignments.map(renderAssignmentCard)
                ) : (
                  <div className="rounded-lg border border-black/10 bg-white/70 p-4 text-sm text-black/50">
                    Aucune formation en attente.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-base">Deja realisees</h3>
                <span className="text-xs uppercase tracking-[0.18em] text-black/40">{completedAssignments.length}</span>
              </div>
              <div className="space-y-3">
                {completedAssignments.length > 0 ? (
                  completedAssignments.map(renderAssignmentCard)
                ) : (
                  <div className="rounded-lg border border-black/10 bg-white/70 p-4 text-sm text-black/50">
                    Aucune formation terminee pour le moment.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {selectedAssignment && (
        <Modal onClose={() => setSelectedAssignment(null)}>
          <div className="w-full max-w-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-display">{selectedAssignment.title || 'Scenario assigne'}</h3>
                <p className="mt-1 text-sm text-black/50">{formatDate(selectedAssignment.assigned_at)}</p>
              </div>
              <QrCode className="h-5 w-5 text-[#e63641]" />
            </div>

            {selectedAssignment.description && (
              <p className="mt-4 text-sm leading-6 text-black/60">{selectedAssignment.description}</p>
            )}

            <div className="mt-5 flex justify-center rounded border border-black/10 bg-white p-4">
              <QrCodeLoader value={selectedAssignment.config_url} size={190} />
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="rounded border border-black/10 bg-white p-2 break-all">
                session_id: {selectedAssignment.session_id}
              </div>
              <div className="rounded border border-black/10 bg-white p-2 break-all">
                {selectedAssignment.config_url}
              </div>
            </div>

            <button type="button" className="btn-primary mt-5 w-full" onClick={() => setSelectedAssignment(null)}>
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default ApprenantPage
