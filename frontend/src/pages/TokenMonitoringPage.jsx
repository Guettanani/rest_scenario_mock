import { useEffect, useState } from 'react'
import { Activity, Clock3, Coins, Cpu, MessagesSquare } from 'lucide-react'
import { generationService } from '../services/dataService'

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/80 p-4">
      <p className="text-black/60 text-sm flex items-center gap-2"><Icon className="h-4 w-4" />{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function TokenMonitoringPage() {
  const [monitoring, setMonitoring] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const payload = await generationService.getTokenMonitoring({ limit: 100 })
        if (mounted) {
          setMonitoring(payload)
        }
      } catch (err) {
        if (mounted) {
          const detail = err?.response?.data?.detail || err?.message || 'Impossible de charger le monitoring tokens.'
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

  const totals = monitoring?.totals || {
    requests: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    avg_latency_ms: 0,
  }

  return (
    <section className="space-y-6 page-enter">
      <header className="panel-surface p-6 border border-black/10">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-lg bg-red-50 border border-red-200 inline-flex items-center justify-center text-red-600">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Monitoring tokens</h2>
            <p className="section-caption">Suivi des couts IA et de la latence des generations.</p>
          </div>
        </div>
      </header>

      {loading && (
        <div className="panel-surface p-6 border border-black/10 text-sm">Chargement en cours...</div>
      )}

      {!loading && error && (
        <div className="panel-surface p-6 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={MessagesSquare} label="Requetes" value={totals.requests} />
            <StatCard icon={Coins} label="Tokens prompt" value={totals.prompt_tokens} />
            <StatCard icon={Coins} label="Tokens completion" value={totals.completion_tokens} />
            <StatCard icon={Coins} label="Tokens total" value={totals.total_tokens} />
            <StatCard icon={Clock3} label="Latence moyenne (ms)" value={Math.round(totals.avg_latency_ms || 0)} />
          </div>

          <article className="panel-surface p-5 border border-black/10">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><Cpu className="h-4 w-4" />Consommation par modele</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-black/10">
                    <th className="py-2 pr-4">Modele</th>
                    <th className="py-2 pr-4">Requetes</th>
                    <th className="py-2 pr-4">Tokens total</th>
                  </tr>
                </thead>
                <tbody>
                  {(monitoring?.by_model || []).map((row) => (
                    <tr key={row.model} className="border-b border-black/5">
                      <td className="py-2 pr-4">{row.model}</td>
                      <td className="py-2 pr-4">{row.requests}</td>
                      <td className="py-2 pr-4">{row.total_tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel-surface p-5 border border-black/10">
            <h3 className="text-base font-semibold mb-3">Dernieres generations</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-black/10">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Modele</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Latence</th>
                    <th className="py-2 pr-4">Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {(monitoring?.recent || []).map((row) => (
                    <tr key={row.generation_id} className="border-b border-black/5">
                      <td className="py-2 pr-4">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                      <td className="py-2 pr-4">{row.model}</td>
                      <td className="py-2 pr-4">{row.total_tokens}</td>
                      <td className="py-2 pr-4">{row.latency_ms || 0} ms</td>
                      <td className="py-2 pr-4 max-w-[480px] truncate">{row.prompt_preview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  )
}

export default TokenMonitoringPage
