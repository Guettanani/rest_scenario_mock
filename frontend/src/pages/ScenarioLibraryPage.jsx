import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Calendar, Cpu, Database, FileText } from 'lucide-react'
import { generationService } from '../services/dataService'
import { APP_ROUTES } from '../routes/paths'

const SCENARIO_IMPORT_KEY = 'scenia_import_scenario_v1'

function ScenarioLibraryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleUseScenario = (item) => {
    const scenario = item?.scenario
    if (!scenario || !Array.isArray(scenario.etapes) || scenario.etapes.length === 0) {
      setError('Ce scenario ne contient pas de donnees exploitables.')
      return
    }

    localStorage.setItem(SCENARIO_IMPORT_KEY, JSON.stringify(scenario))
    navigate(APP_ROUTES.dashboard)
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const payload = await generationService.getLibrary({ limit: 50, offset: 0 })
        if (mounted) {
          setItems(payload.items || [])
        }
      } catch (err) {
        if (mounted) {
          const detail = err?.response?.data?.detail || err?.message || 'Impossible de charger la bibliotheque.'
          setError(detail)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="space-y-6 page-enter">
      <header className="panel-surface p-6 border border-black/10">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-lg bg-red-50 border border-red-200 inline-flex items-center justify-center text-red-600">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Bibliotheque de generations</h2>
            <p className="section-caption">Historique des scenarios generes avec qualite et consommation tokens.</p>
          </div>
        </div>
      </header>

      {loading && (
        <div className="panel-surface p-6 border border-black/10 text-sm">Chargement en cours...</div>
      )}

      {!loading && error && (
        <div className="panel-surface p-6 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="panel-surface p-6 border border-black/10 text-sm">Aucune generation disponible pour le moment.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4">
          {items.map((item) => (
            <article key={item.generation_id} className="panel-surface p-5 border border-black/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{item.titre || 'Scenario sans titre'}</h3>
                  <p className="text-sm text-black/70 mt-1">{item.description || 'Sans description.'}</p>
                </div>
                <span className="px-2 py-1 text-xs rounded-full border border-black/15 bg-white uppercase tracking-wide">
                  {item.status || 'generated'}
                </span>
              </div>

              <div className="mt-4 grid md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-black/10 p-3 bg-white/70">
                  <p className="text-black/60 flex items-center gap-2"><Cpu className="h-4 w-4" />Modele</p>
                  <p className="font-medium mt-1">{item.usage?.model || '-'}</p>
                </div>
                <div className="rounded-lg border border-black/10 p-3 bg-white/70">
                  <p className="text-black/60 flex items-center gap-2"><Database className="h-4 w-4" />Tokens</p>
                  <p className="font-medium mt-1">{item.usage?.total_tokens || 0}</p>
                </div>
                <div className="rounded-lg border border-black/10 p-3 bg-white/70">
                  <p className="text-black/60 flex items-center gap-2"><FileText className="h-4 w-4" />Qualite</p>
                  <p className="font-medium mt-1">{item.quality?.score ?? 'N/A'}</p>
                </div>
                <div className="rounded-lg border border-black/10 p-3 bg-white/70">
                  <p className="text-black/60 flex items-center gap-2"><Calendar className="h-4 w-4" />Date</p>
                  <p className="font-medium mt-1">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleUseScenario(item)}
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition-colors duration-150 text-sm font-medium"
                >
                  Utiliser ce scenario
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ScenarioLibraryPage
