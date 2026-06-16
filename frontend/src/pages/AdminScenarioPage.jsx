import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  GripVertical,
  Save,
  Play,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Monitor,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { APP_ROUTES } from '../routes/paths'
import { adminService } from '../services/authService'
import LiveMonitoring from '../components/LiveMonitoring'
import '../styles/adminScenario.css'

const INITIAL_CONFIG = {
  prompt:
    'Scenario pedagogique debutant : Procedure simple mise en service poste avec EPI et manipulation vannes R1/R2',
  procedure: 'Procedure Pedagogique Simple',
  tempsImparti: 5,
  messageDebut:
    'Bienvenue dans cette simulation pedagogique. Suivez attentivement les consignes de securite.',
  meteo: 'jour_soleil',
  seuilAgentIA: 1,
  typeDemandeClient: 'habitation',
  demandeClientPattern: 'stable',
  demandeClientBase: 800,
  demandeClientAmplitude: 80,
  demandeClientPeriode: 300,
  niveauDifficulte: 'debutant',
  etiquettes: true,
  ambianceSonore: 0,
  assistanceIA: 'tuteur',
  conditionEchec: 'aucune',
  equipements: {
    R1: { position: 0, statut: 'libre', inScenario: true },
    R2: { position: 0, statut: 'libre', inScenario: true },
    R3: { position: 0, statut: 'libre', inScenario: false },
    R4: { position: 0, statut: 'libre', inScenario: false },
    R0: { position: 0, statut: 'libre', inScenario: false },
  },
  typeVanne: 'gazfio',
  reseauAval: 'tres_gros',
  alarmeSMGBasse: 15,
  alarmeSMGHaute: 60,
  alarmeTelBasse: 10,
  alarmeTelHaute: 65,
  soupapeBypasse: 'fermee',
  vanneSecurite: 'armee',
  afficherPanneauR4: false,
  pressionCible: 45,
  pressionBypass: 45,
  pressionLivraison: 45,
  schemaImageUrl: '/mnt/user-data/uploads/1773928855968_image.png',
  etapes: [
    [
      {
        id: 1,
        nom: 'Equiper les EPI',
        type: 'verification',
        erreur: 'EPI non portes - Obligation de securite',
        penalite: 30,
        criticite: 'critique',
      },
    ],
    [
      {
        id: 2,
        nom: 'Ouvrir R2 (sortie poste)',
        type: 'action',
        erreur: 'R2 non ouvert - Sequence incorrecte',
        penalite: 20,
        criticite: 'haute',
      },
    ],
    [
      {
        id: 3,
        nom: 'Ouvrir R1 (entree poste)',
        type: 'action',
        erreur: 'R1 ouvert avant R2 - Risque surpression',
        penalite: 25,
        criticite: 'critique',
      },
    ],
    [
      {
        id: 4,
        nom: 'Fermer R1 (entree poste)',
        type: 'action',
        erreur: 'R1 ferme au mauvais moment - Interruption flux',
        penalite: 20,
        criticite: 'haute',
      },
    ],
    [
      {
        id: 5,
        nom: 'Fermer R2 (sortie poste)',
        type: 'action',
        erreur: 'R2 ferme avant R1 - Procedure non respectee',
        penalite: 20,
        criticite: 'haute',
      },
    ],
  ],
}

const difficultyPresets = {
  debutant: {
    etiquettes: true,
    ambianceSonore: 0,
    assistanceIA: 'tuteur',
    conditionEchec: 'aucune',
    typeDemandeClient: 'habitation',
    demandeClientPattern: 'stable',
    demandeClientBase: 800,
    demandeClientAmplitude: 50,
  },
  intermediaire: {
    etiquettes: false,
    ambianceSonore: 10,
    assistanceIA: 'reactif',
    conditionEchec: 'score_zero',
    typeDemandeClient: 'petit_industriel',
    demandeClientPattern: 'sinusoidal',
    demandeClientBase: 1000,
    demandeClientAmplitude: 100,
  },
  confirme: {
    etiquettes: false,
    ambianceSonore: 50,
    assistanceIA: 'silence',
    conditionEchec: 'echec_immediat',
    typeDemandeClient: 'grand_industriel',
    demandeClientPattern: 'erratique',
    demandeClientBase: 1500,
    demandeClientAmplitude: 200,
  },
}

const SCENARIO_DRAFT_KEY = 'scenia_admin_scenario_draft'
const SCENARIO_RUNTIME_KEY = 'scenia_runtime_scenario_config'

function cloneInitialConfig() {
  return JSON.parse(JSON.stringify(INITIAL_CONFIG))
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function AdminScenarioPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  const [config, setConfig] = useState(cloneInitialConfig)
  const [selectedNode, setSelectedNode] = useState(null)
  const [draggedNode, setDraggedNode] = useState(null)
  const [dragOverNode, setDragOverNode] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [notice, setNotice] = useState('')
  const [auditEntries, setAuditEntries] = useState([])
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditLimit, setAuditLimit] = useState(20)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditSessionFilter, setAuditSessionFilter] = useState('')
  const [auditUserFilter, setAuditUserFilter] = useState('')

  const selectedEtape = selectedNode
    ? config.etapes[selectedNode.rowIndex]?.[selectedNode.colIndex]
    : null

  const totalPenalite = useMemo(
    () =>
      config.etapes
        .flat()
        .reduce((acc, etape) => acc + (Number(etape.penalite) || 0), 0),
    [config.etapes],
  )

  const generalChecklist = useMemo(() => {
    const totalSteps = config.etapes.flat().length
    return [
      {
        label: 'Prompt scenario detaille',
        ok: config.prompt.trim().length >= 30,
        hint: 'Minimum 30 caracteres pour un contexte IA exploitable',
      },
      {
        label: 'Procedure explicite',
        ok: config.procedure.trim().length > 0,
        hint: 'Selectionnez un mode de procedure clair',
      },
      {
        label: 'Sequence d etapes definie',
        ok: totalSteps >= 3,
        hint: 'Au moins 3 etapes pour un scenario coherent',
      },
      {
        label: 'Brief de demarrage renseigne',
        ok: config.messageDebut.trim().length >= 20,
        hint: 'Le message doit orienter le participant des le debut',
      },
    ]
  }, [config])

  const readinessScore = useMemo(() => {
    const passed = generalChecklist.filter((item) => item.ok).length
    return Math.round((passed / generalChecklist.length) * 100)
  }, [generalChecklist])

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(SCENARIO_DRAFT_KEY)
      if (!rawDraft) return
      const parsed = JSON.parse(rawDraft)
      setConfig((prev) => ({ ...prev, ...parsed }))
      setNotice('Brouillon recharge depuis la derniere session.')
    } catch (_error) {
      setNotice('Impossible de relire le brouillon, configuration initiale conservee.')
    }
  }, [])


  const loadRuntimeAudit = useCallback(async ({ nextOffset = 0, nextLimit = auditLimit } = {}) => {
    setAuditLoading(true)
    setAuditError('')

    try {
      const params = {
        offset: nextOffset,
        limit: nextLimit,
      }

      if (auditSessionFilter.trim()) {
        params.session_id = auditSessionFilter.trim()
      }

      const parsedUserId = Number.parseInt(auditUserFilter, 10)
      if (Number.isFinite(parsedUserId) && parsedUserId > 0) {
        params.updated_by_user_id = parsedUserId
      }

      const data = await adminService.getRuntimeConfigHistory(params)
      setAuditEntries(Array.isArray(data.entries) ? data.entries : [])
      setAuditOffset(data.offset ?? nextOffset)
      setAuditLimit(data.limit ?? nextLimit)
      setAuditTotal(data.total ?? 0)
      setAuditHasMore(Boolean(data.has_more))
    } catch (error) {
      setAuditError(error.message || 'Erreur lors du chargement de l\'audit runtime.')
    } finally {
      setAuditLoading(false)
    }
  }, [auditLimit, auditSessionFilter, auditUserFilter])

  useEffect(() => {
    if (activeTab !== 'audit') return
    loadRuntimeAudit({ nextOffset: 0, nextLimit: auditLimit })
  }, [activeTab, auditLimit, loadRuntimeAudit])
  if (user?.role !== 'admin') {
    return (
      <div className="scenario-admin-denied">
        <ShieldAlert size={58} />
        <h2>Acces reserve</h2>
        <p>Cette page est reservee aux administrateurs.</p>
      </div>
    )
  }

  const updateConfig = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const updateEquipement = (id, field, value) => {
    setConfig((prev) => ({
      ...prev,
      equipements: {
        ...prev.equipements,
        [id]: {
          ...prev.equipements[id],
          [field]: value,
        },
      },
    }))
  }

  const updateEtape = (rowIndex, colIndex, field, value) => {
    setConfig((prev) => ({
      ...prev,
      etapes: prev.etapes.map((row, rIdx) =>
        rIdx === rowIndex
          ? row.map((etape, cIdx) =>
              cIdx === colIndex ? { ...etape, [field]: value } : etape,
            )
          : row,
      ),
    }))
  }

  const handleDragStart = (rowIndex, colIndex) => {
    setDraggedNode({ rowIndex, colIndex })
  }

  const handleDrop = (targetRowIndex, targetColIndex) => {
    if (!draggedNode) return

    const { rowIndex: srcRowIndex, colIndex: srcColIndex } = draggedNode

    if (srcRowIndex === targetRowIndex && srcColIndex === targetColIndex) {
      setDraggedNode(null)
      setDragOverNode(null)
      return
    }

    setConfig((prev) => {
      const newEtapes = prev.etapes.map((row) => row.map((etape) => ({ ...etape })))
      const source = newEtapes[srcRowIndex][srcColIndex]
      newEtapes[srcRowIndex][srcColIndex] = newEtapes[targetRowIndex][targetColIndex]
      newEtapes[targetRowIndex][targetColIndex] = source

      return { ...prev, etapes: newEtapes }
    })

    setDraggedNode(null)
    setDragOverNode(null)
  }

  const exportConfig = () => {
    const jsonConfig = JSON.stringify(config, null, 2)
    const blob = new Blob([jsonConfig], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'scenario_pedagogique_config.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Configuration exportee avec succes.')
  }

  const saveDraft = () => {
    localStorage.setItem(SCENARIO_DRAFT_KEY, JSON.stringify(config))
    setNotice('Brouillon enregistre localement.')
  }

  const handleStartScenario = () => {
    const blockers = generalChecklist.filter((item) => !item.ok)
    if (blockers.length > 0) {
      setActiveTab('general')
      setNotice(`Configuration incomplete: ${blockers[0].label}.`)
      return
    }

    localStorage.setItem(SCENARIO_RUNTIME_KEY, JSON.stringify(config))
    setNotice('Configuration validee. Redirection vers le parametrage de scénario...')
    window.setTimeout(() => navigate(APP_ROUTES.dashboard), 350)
  }

  const resetConfig = () => {
    setConfig(cloneInitialConfig())
    setSelectedNode(null)
    localStorage.removeItem(SCENARIO_DRAFT_KEY)
    localStorage.removeItem(SCENARIO_RUNTIME_KEY)
    setNotice('Configuration reinitialisee.')
  }

  const applyPreset = (preset) => {
    const presetConfig = difficultyPresets[preset]
    setConfig((prev) => ({ ...prev, ...presetConfig, niveauDifficulte: preset }))
  }

  const buildChartPoints = () => {
    const steps = 96
    const points = []

    let effectiveAmplitude = config.demandeClientAmplitude
    if (config.typeDemandeClient === 'habitation') effectiveAmplitude *= 0.3
    if (config.typeDemandeClient === 'petit_industriel') effectiveAmplitude *= 0.7
    if (config.typeDemandeClient === 'grand_industriel') effectiveAmplitude *= 1.2

    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * config.demandeClientPeriode
      let value = config.demandeClientBase

      if (config.demandeClientPattern === 'stable') {
        value +=
          effectiveAmplitude *
          0.15 *
          Math.sin((2 * Math.PI * t) / config.demandeClientPeriode)
      } else if (config.demandeClientPattern === 'sinusoidal') {
        value +=
          effectiveAmplitude * Math.sin((2 * Math.PI * t) / config.demandeClientPeriode)
      } else if (config.demandeClientPattern === 'creneaux') {
        value +=
          Math.floor(
            (t % config.demandeClientPeriode) / (config.demandeClientPeriode / 2),
          ) === 0
            ? effectiveAmplitude
            : -effectiveAmplitude
      } else {
        const pseudo = Math.sin((i + 1) * 12.9898) * 43758.5453
        const noise = (pseudo - Math.floor(pseudo)) * 2 - 1
        value += effectiveAmplitude * noise
      }

      points.push({ x: (i / steps) * 100, y: value })
    }

    return points
  }

  const points = buildChartPoints()
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  const rangeY = maxY - minY || 1

  const pathData = points
    .map((point, index) => {
      const x = 40 + point.x * 4.8
      const y = 220 - ((point.y - minY) / rangeY) * 170
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div className="scenario-admin-shell">
      <div className="scenario-admin-bg" aria-hidden="true" />
      <div className="scenario-admin-card">
        <header className="scenario-admin-header">
          <div>
            <h1>Administration Scenario Pedagogique</h1>
            <p>Configuration complete du scenario de simulation, prete pour export.</p>
          </div>
          <div className="scenario-admin-badge">
            <Settings2 size={16} />
            Configuration assistee IA
          </div>
        </header>

        <nav className="scenario-admin-tabs" aria-label="Onglets configuration">
          <button
            type="button"
            className={activeTab === 'general' ? 'active' : ''}
            onClick={() => setActiveTab('general')}
          >
            Parametres Generaux
          </button>
          <button
            type="button"
            className={activeTab === 'graph' ? 'active' : ''}
            onClick={() => setActiveTab('graph')}
          >
            Sequencage
          </button>
          <button
            type="button"
            className={activeTab === 'objets' ? 'active' : ''}
            onClick={() => setActiveTab('objets')}
          >
            Objets et Etats
          </button>
          <button
            type="button"
            className={activeTab === 'difficulte' ? 'active' : ''}
            onClick={() => setActiveTab('difficulte')}
          >
            Profil de Difficulte
          </button>
          <button
            type="button"
            className={activeTab === 'technique' ? 'active' : ''}
            onClick={() => setActiveTab('technique')}
          >
            Parametres Techniques
          </button>
          <button
            type="button"
            className={activeTab === 'monitoring' ? 'active' : ''}
            onClick={() => setActiveTab('monitoring')}
          >
            <Monitor size={16} />
            Suivi en Direct
          </button>
          <button
            type="button"
            className={activeTab === 'audit' ? 'active' : ''}
            onClick={() => setActiveTab('audit')}
          >
            Audit Runtime
          </button>
        </nav>

        <section className="scenario-admin-content">
          {notice && <div className="scenario-admin-notice">{notice}</div>}

          {activeTab === 'general' && (
            <>
              <section className="scenario-section">
                <h2>Parametres Generaux - Sous-ensemble principal</h2>
                <p className="scenario-tip">
                  Ce sous-ensemble pilote le cadrage pedagogique du scenario avant les
                  reglages techniques. Tout ce qui est ici impacte directement le comportement
                  de l&apos;assistance IA et la lisibilite pour l&apos;apprenant.
                </p>

                <div className="scenario-general-top">
                  <div className="scenario-readiness">
                    <p>Taux de completude</p>
                    <strong>{readinessScore}%</strong>
                    <div className="scenario-progress-track" aria-hidden="true">
                      <span style={{ width: `${readinessScore}%` }} />
                    </div>
                  </div>
                  <div className="scenario-check-grid">
                    {generalChecklist.map((item) => (
                      <article
                        key={item.label}
                        className={`scenario-check-card ${item.ok ? 'ok' : ''}`}
                      >
                        <div>
                          <p>{item.label}</p>
                          <small>{item.hint}</small>
                        </div>
                        {item.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="scenario-warning-box">
                <AlertTriangle size={18} />
                <div>
                  <strong>Garde-fou IA</strong>
                  <p>
                    Verifiez les valeurs generees automatiquement puis corrigez-les avant
                    demarrage.
                  </p>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Cadrage pedagogique</h2>
                <div className="scenario-form-grid">
                  <label className="scenario-full-width">
                    <span>Prompt IA principal</span>
                    <textarea
                      rows="3"
                      value={config.prompt}
                      onChange={(event) => updateConfig('prompt', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Procedure pedagogique</span>
                    <select
                      value={config.procedure}
                      onChange={(event) => updateConfig('procedure', event.target.value)}
                    >
                      <option value="Procedure Pedagogique Simple">Procedure Pedagogique Simple</option>
                      <option value="Procedure Expliquee Guidee">Procedure Expliquee Guidee</option>
                      <option value="Procedure Evaluation Autonome">Procedure Evaluation Autonome</option>
                    </select>
                  </label>

                  <label>
                    <span>Temps imparti (minutes)</span>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={config.tempsImparti}
                      onChange={(event) =>
                        updateConfig('tempsImparti', toInt(event.target.value, config.tempsImparti))
                      }
                    />
                    <small>{config.tempsImparti} minutes</small>
                  </label>

                  <label>
                    <span>Conditions meteo</span>
                    <select
                      value={config.meteo}
                      onChange={(event) => updateConfig('meteo', event.target.value)}
                    >
                      <option value="jour_soleil">Jour + Soleil</option>
                      <option value="jour_pluie">Jour + Pluie</option>
                      <option value="nuit_calme">Nuit Calme</option>
                      <option value="nuit_pluie">Nuit + Pluie</option>
                    </select>
                  </label>

                  <label>
                    <span>Seuil intervention Agent IA</span>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={config.seuilAgentIA}
                      onChange={(event) =>
                        updateConfig('seuilAgentIA', toInt(event.target.value, config.seuilAgentIA))
                      }
                    />
                    <small>
                      {config.seuilAgentIA === 0
                        ? 'Intervention immediate'
                        : `Apres ${config.seuilAgentIA} erreur(s)`}
                    </small>
                  </label>
                </div>

                <div className="scenario-inline-actions">
                  <button type="button" onClick={saveDraft}>
                    <Save size={16} />
                    Sauvegarder brouillon
                  </button>
                  <button type="button" onClick={handleStartScenario} className="primary">
                    <Play size={16} />
                    Valider et demarrer
                  </button>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Demande Gaz Client</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Type de client</span>
                    <select
                      value={config.typeDemandeClient}
                      onChange={(event) => updateConfig('typeDemandeClient', event.target.value)}
                    >
                      <option value="habitation">Habitations (faible fluctuation)</option>
                      <option value="petit_industriel">
                        Petit industriel (fluctuation moderee)
                      </option>
                      <option value="grand_industriel">
                        Grand industriel (forte fluctuation)
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>Pattern de demande</span>
                    <select
                      value={config.demandeClientPattern}
                      onChange={(event) => updateConfig('demandeClientPattern', event.target.value)}
                    >
                      <option value="stable">Stable (legere variation)</option>
                      <option value="sinusoidal">Sinusoidal (variation douce)</option>
                      <option value="creneaux">Creneaux (variation brutale)</option>
                      <option value="erratique">Erratique (variation aleatoire)</option>
                    </select>
                  </label>

                  <label>
                    <span>Debit de base (Nm3/h)</span>
                    <input
                      type="number"
                      value={config.demandeClientBase}
                      onChange={(event) =>
                        updateConfig(
                          'demandeClientBase',
                          toInt(event.target.value, config.demandeClientBase),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Amplitude variation (Nm3/h)</span>
                    <input
                      type="number"
                      value={config.demandeClientAmplitude}
                      onChange={(event) =>
                        updateConfig(
                          'demandeClientAmplitude',
                          toInt(event.target.value, config.demandeClientAmplitude),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Periode variation (s)</span>
                    <input
                      type="number"
                      value={config.demandeClientPeriode}
                      onChange={(event) =>
                        updateConfig(
                          'demandeClientPeriode',
                          toInt(event.target.value, config.demandeClientPeriode),
                        )
                      }
                    />
                  </label>
                </div>

                <div className="scenario-chart-wrap">
                  <svg viewBox="0 0 560 280" role="img" aria-label="Courbe demande client">
                    <line x1="40" y1="220" x2="520" y2="220" />
                    <line x1="40" y1="30" x2="40" y2="220" />
                    <text x="280" y="252" textAnchor="middle">
                      Temps
                    </text>
                    <text x="18" y="125" textAnchor="middle" transform="rotate(-90 18 125)">
                      Debit
                    </text>
                    <text x="30" y="225" textAnchor="end">
                      {Math.round(minY)}
                    </text>
                    <text x="30" y="35" textAnchor="end">
                      {Math.round(maxY)}
                    </text>
                    <text x="520" y="235" textAnchor="end">
                      {config.demandeClientPeriode}s
                    </text>
                    <path d={pathData} />
                  </svg>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Message de Bienvenue</h2>
                <label className="scenario-full-width">
                  <span>Message affiche au debut</span>
                  <textarea
                    rows="4"
                    value={config.messageDebut}
                    onChange={(event) => updateConfig('messageDebut', event.target.value)}
                  />
                </label>
              </section>
            </>
          )}

          {activeTab === 'graph' && (
            <section className="scenario-section">
              <h2>Editeur de Graphe d&apos;Etat</h2>
              <p className="scenario-tip">
                Faites glisser les blocs pour reorganiser les etapes. Cliquez sur le point
                d&apos;alerte pour regler erreurs, criticite et penalite.
              </p>
              <div className="scenario-graph">
                <div className="scenario-node fixed">Debut</div>
                <div className="scenario-arrow" aria-hidden="true" />

                {config.etapes.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`}>
                    <div className="scenario-node-row">
                      {row.map((etape, colIndex) => {
                        const isDragOver =
                          dragOverNode?.rowIndex === rowIndex &&
                          dragOverNode?.colIndex === colIndex

                        return (
                          <article
                            key={etape.id}
                            className={`scenario-node ${isDragOver ? 'drag-over' : ''}`}
                            draggable
                            onDragStart={() => handleDragStart(rowIndex, colIndex)}
                            onDragEnd={() => {
                              setDraggedNode(null)
                              setDragOverNode(null)
                            }}
                            onDragOver={(event) => {
                              event.preventDefault()
                              setDragOverNode({ rowIndex, colIndex })
                            }}
                            onDrop={(event) => {
                              event.preventDefault()
                              handleDrop(rowIndex, colIndex)
                            }}
                            onDragLeave={() => setDragOverNode(null)}
                          >
                            <div className="scenario-node-main">
                              <GripVertical size={16} />
                              <span>
                                {etape.id}. {etape.nom}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="scenario-node-alert"
                              aria-label="Configurer erreur"
                              onClick={() => setSelectedNode({ rowIndex, colIndex })}
                            >
                              !
                            </button>
                          </article>
                        )
                      })}
                    </div>
                    {rowIndex < config.etapes.length - 1 && (
                      <div className="scenario-arrow" aria-hidden="true" />
                    )}
                  </div>
                ))}

                <div className="scenario-arrow" aria-hidden="true" />
                <div className="scenario-node fixed">Fin</div>
              </div>

              <div className="scenario-stat-box">
                <span>Etapes totales: {config.etapes.flat().length}</span>
                <span>Penalite cumulee: {totalPenalite}%</span>
              </div>
            </section>
          )}

          {activeTab === 'objets' && (
            <>
              <section className="scenario-section">
                <h2>Configuration Equipements</h2>
                <div className="scenario-equipment-grid">
                  {Object.entries(config.equipements).map(([id, equipement]) => (
                    <article
                      key={id}
                      className={`scenario-equipment-card ${
                        equipement.inScenario ? 'in-scenario' : ''
                      }`}
                    >
                      <h3>{id}</h3>
                      <p>
                        {id === 'R4' ? 'Robinet laminage' : 'Robinet barrage'}
                        {equipement.inScenario ? ' - utilise dans ce scenario' : ''}
                      </p>

                      <label>
                        <span>Position initiale</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={equipement.position}
                          onChange={(event) =>
                            updateEquipement(
                              id,
                              'position',
                              toInt(event.target.value, equipement.position),
                            )
                          }
                        />
                        <small>{equipement.position}%</small>
                      </label>

                      <label>
                        <span>Statut mecanique</span>
                        <select
                          value={equipement.statut}
                          onChange={(event) =>
                            updateEquipement(id, 'statut', event.target.value)
                          }
                        >
                          <option value="libre">Libre</option>
                          <option value="bloque">Bloque / Panne</option>
                        </select>
                      </label>
                    </article>
                  ))}
                </div>
              </section>

              <section className="scenario-section">
                <h2>Schema du Poste</h2>
                <div className="scenario-form-grid">
                  <label className="scenario-full-width">
                    <span>URL schema image</span>
                    <input
                      type="text"
                      value={config.schemaImageUrl}
                      onChange={(event) => {
                        setImageError(false)
                        updateConfig('schemaImageUrl', event.target.value)
                      }}
                    />
                  </label>
                </div>
                {imageError ? (
                  <div className="scenario-image-fallback">
                    Image indisponible. Verifiez l&apos;URL du schema.
                  </div>
                ) : (
                  <img
                    className="scenario-schema-image"
                    src={config.schemaImageUrl}
                    alt="Schema du poste"
                    onError={() => setImageError(true)}
                  />
                )}
              </section>
            </>
          )}

          {activeTab === 'difficulte' && (
            <>
              <section className="scenario-section">
                <h2>Presets de Difficulte</h2>
                <div className="scenario-preset-grid">
                  <button
                    type="button"
                    className={config.niveauDifficulte === 'debutant' ? 'active' : ''}
                    onClick={() => applyPreset('debutant')}
                  >
                    Debutant
                    <small>Labels visibles + IA tuteur</small>
                  </button>
                  <button
                    type="button"
                    className={config.niveauDifficulte === 'intermediaire' ? 'active' : ''}
                    onClick={() => applyPreset('intermediaire')}
                  >
                    Intermediaire
                    <small>IA reactive + variation moderee</small>
                  </button>
                  <button
                    type="button"
                    className={config.niveauDifficulte === 'confirme' ? 'active' : ''}
                    onClick={() => applyPreset('confirme')}
                  >
                    Confirme
                    <small>Silence total + echec immediat</small>
                  </button>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Reglages Personnalises</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Etiquettes</span>
                    <button
                      type="button"
                      className={`scenario-toggle ${config.etiquettes ? 'active' : ''}`}
                      onClick={() => updateConfig('etiquettes', !config.etiquettes)}
                    >
                      <span />
                    </button>
                    <small>{config.etiquettes ? 'Affichees' : 'Masquees'}</small>
                  </label>

                  <label>
                    <span>Ambiance sonore</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.ambianceSonore}
                      onChange={(event) =>
                        updateConfig(
                          'ambianceSonore',
                          toInt(event.target.value, config.ambianceSonore),
                        )
                      }
                    />
                    <small>{config.ambianceSonore}%</small>
                  </label>

                  <label>
                    <span>Assistance Agent IA</span>
                    <select
                      value={config.assistanceIA}
                      onChange={(event) => updateConfig('assistanceIA', event.target.value)}
                    >
                      <option value="tuteur">Mode tuteur</option>
                      <option value="reactif">Mode reactif</option>
                      <option value="silence">Silence total</option>
                    </select>
                  </label>

                  <label>
                    <span>Condition d&apos;echec</span>
                    <select
                      value={config.conditionEchec}
                      onChange={(event) => updateConfig('conditionEchec', event.target.value)}
                    >
                      <option value="aucune">Aucune</option>
                      <option value="score_zero">Arret si score = 0</option>
                      <option value="echec_immediat">Echec immediat</option>
                    </select>
                  </label>
                </div>
              </section>
            </>
          )}

          {activeTab === 'technique' && (
            <>
              <section className="scenario-section">
                <h2>Configuration Materiel</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Type de vanne</span>
                    <select
                      value={config.typeVanne}
                      onChange={(event) => updateConfig('typeVanne', event.target.value)}
                    >
                      <option value="gazfio">Gazfio</option>
                      <option value="francel">Francel</option>
                    </select>
                  </label>

                  <label>
                    <span>Reseau en aval</span>
                    <select
                      value={config.reseauAval}
                      onChange={(event) => updateConfig('reseauAval', event.target.value)}
                    >
                      <option value="tres_gros">Tres gros (variations amorties)</option>
                      <option value="gros">Gros</option>
                      <option value="moyen">Moyen</option>
                      <option value="petit">Petit (variations rapides)</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Pressions</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Pression cible (bar)</span>
                    <input
                      type="number"
                      value={config.pressionCible}
                      onChange={(event) =>
                        updateConfig('pressionCible', toInt(event.target.value, config.pressionCible))
                      }
                    />
                  </label>

                  <label>
                    <span>Pression bypass (bar)</span>
                    <input
                      type="number"
                      value={config.pressionBypass}
                      onChange={(event) =>
                        updateConfig(
                          'pressionBypass',
                          toInt(event.target.value, config.pressionBypass),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Pression livraison (bar)</span>
                    <input
                      type="number"
                      value={config.pressionLivraison}
                      onChange={(event) =>
                        updateConfig(
                          'pressionLivraison',
                          toInt(event.target.value, config.pressionLivraison),
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Configuration Alarmes</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Alarme SMG - Seuil bas (bar)</span>
                    <input
                      type="number"
                      value={config.alarmeSMGBasse}
                      onChange={(event) =>
                        updateConfig(
                          'alarmeSMGBasse',
                          toInt(event.target.value, config.alarmeSMGBasse),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Alarme SMG - Seuil haut (bar)</span>
                    <input
                      type="number"
                      value={config.alarmeSMGHaute}
                      onChange={(event) =>
                        updateConfig(
                          'alarmeSMGHaute',
                          toInt(event.target.value, config.alarmeSMGHaute),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Alarme telephone - Seuil bas (bar)</span>
                    <input
                      type="number"
                      value={config.alarmeTelBasse}
                      onChange={(event) =>
                        updateConfig(
                          'alarmeTelBasse',
                          toInt(event.target.value, config.alarmeTelBasse),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Alarme telephone - Seuil haut (bar)</span>
                    <input
                      type="number"
                      value={config.alarmeTelHaute}
                      onChange={(event) =>
                        updateConfig(
                          'alarmeTelHaute',
                          toInt(event.target.value, config.alarmeTelHaute),
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="scenario-section">
                <h2>Parametres Avances</h2>
                <div className="scenario-form-grid">
                  <label>
                    <span>Soupape de bypass</span>
                    <select
                      value={config.soupapeBypasse}
                      onChange={(event) => updateConfig('soupapeBypasse', event.target.value)}
                    >
                      <option value="ouverte">Ouverte</option>
                      <option value="fermee">Fermee</option>
                    </select>
                  </label>

                  <label>
                    <span>Vanne de securite</span>
                    <select
                      value={config.vanneSecurite}
                      onChange={(event) => updateConfig('vanneSecurite', event.target.value)}
                    >
                      <option value="armable">Armable</option>
                      <option value="armee">Armee</option>
                      <option value="declenchee">Declenchee</option>
                    </select>
                  </label>

                  <label>
                    <span>Panneau R4 visible</span>
                    <button
                      type="button"
                      className={`scenario-toggle ${config.afficherPanneauR4 ? 'active' : ''}`}
                      onClick={() =>
                        updateConfig('afficherPanneauR4', !config.afficherPanneauR4)
                      }
                    >
                      <span />
                    </button>
                    <small>{config.afficherPanneauR4 ? 'Oui' : 'Non'}</small>
                  </label>
                </div>
              </section>
            </>
          )}

          {activeTab === 'monitoring' && (
            <LiveMonitoring />
          )}

          {activeTab === 'audit' && (
            <section className="scenario-section">
              <h2>Audit Runtime des Configurations</h2>
              <p className="scenario-tip">
                Historique des configurations runtime persistees via /api/v1/config/history.
              </p>

              <div className="scenario-audit-filters">
                <label>
                  <span>Filtre session_id</span>
                  <input
                    type="text"
                    value={auditSessionFilter}
                    onChange={(event) => setAuditSessionFilter(event.target.value)}
                    placeholder="session_id"
                  />
                </label>
                <label>
                  <span>Filtre updated_by_user_id</span>
                  <input
                    type="number"
                    min="1"
                    value={auditUserFilter}
                    onChange={(event) => setAuditUserFilter(event.target.value)}
                    placeholder="ex: 42"
                  />
                </label>
                <label>
                  <span>Taille de page</span>
                  <select
                    value={auditLimit}
                    onChange={(event) => {
                      const nextLimit = toInt(event.target.value, auditLimit)
                      setAuditLimit(nextLimit)
                    }}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </label>
                <div className="scenario-inline-actions">
                  <button
                    type="button"
                    onClick={() => loadRuntimeAudit({ nextOffset: 0, nextLimit: auditLimit })}
                  >
                    Rechercher
                  </button>
                </div>
              </div>

              <div className="scenario-audit-meta">
                <span>Total: {auditTotal}</span>
                <span>Offset: {auditOffset}</span>
                <span>Limit: {auditLimit}</span>
              </div>

              {auditError && <div className="scenario-admin-notice">{auditError}</div>}

              <div className="scenario-audit-table-wrap">
                <table className="scenario-audit-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Scenario</th>
                      <th>User</th>
                      <th>Version</th>
                      <th>Updated</th>
                      <th>Apercu Config</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      <tr>
                        <td colSpan="6">Chargement...</td>
                      </tr>
                    ) : auditEntries.length === 0 ? (
                      <tr>
                        <td colSpan="6">Aucune entree d'audit.</td>
                      </tr>
                    ) : (
                      auditEntries.map((entry, idx) => (
                        <tr key={`${entry.session_id}-${entry.updated_at}-${idx}`}>
                          <td>{entry.session_id}</td>
                          <td>{entry.scenario_id ?? '-'}</td>
                          <td>{entry.updated_by_user_id ?? '-'}</td>
                          <td>{entry.version}</td>
                          <td>{entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '-'}</td>
                          <td>
                            <pre>{JSON.stringify(entry.config, null, 2)}</pre>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="scenario-inline-actions scenario-audit-pagination">
                <button
                  type="button"
                  onClick={() => loadRuntimeAudit({ nextOffset: Math.max(0, auditOffset - auditLimit), nextLimit: auditLimit })}
                  disabled={auditLoading || auditOffset === 0}
                >
                  Page precedente
                </button>
                <button
                  type="button"
                  onClick={() => loadRuntimeAudit({ nextOffset: auditOffset + auditLimit, nextLimit: auditLimit })}
                  disabled={auditLoading || !auditHasMore}
                >
                  Page suivante
                </button>
              </div>
            </section>
          )}

        </section>

        <footer className="scenario-admin-actions">
          <button
            type="button"
            className="primary"
            onClick={handleStartScenario}
          >
            <Play size={16} />
            Valider et Demarrer
          </button>
          <button type="button" onClick={saveDraft}>
            <Save size={16} />
            Sauvegarder Brouillon
          </button>
          <button type="button" onClick={exportConfig}>
            <Download size={16} />
            Exporter Configuration
          </button>
          <button type="button" onClick={resetConfig}>
            <RotateCcw size={16} />
            Reinitialiser
          </button>
        </footer>
      </div>

      {selectedEtape && (
        <div className="scenario-modal-backdrop" role="presentation" onClick={() => setSelectedNode(null)}>
          <div className="scenario-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Configuration erreur: {selectedEtape.nom}</h3>

            <label>
              <span>Message d&apos;erreur</span>
              <textarea
                rows="4"
                value={selectedEtape.erreur}
                onChange={(event) =>
                  updateEtape(
                    selectedNode.rowIndex,
                    selectedNode.colIndex,
                    'erreur',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>Niveau de criticite</span>
              <select
                value={selectedEtape.criticite}
                onChange={(event) =>
                  updateEtape(
                    selectedNode.rowIndex,
                    selectedNode.colIndex,
                    'criticite',
                    event.target.value,
                  )
                }
              >
                <option value="faible">Faible</option>
                <option value="moyenne">Moyenne</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique</option>
              </select>
            </label>

            <label>
              <span>Penalite (% score)</span>
              <input
                type="range"
                min="0"
                max="50"
                value={selectedEtape.penalite}
                onChange={(event) =>
                  updateEtape(
                    selectedNode.rowIndex,
                    selectedNode.colIndex,
                    'penalite',
                    toInt(event.target.value, selectedEtape.penalite),
                  )
                }
              />
              <small>-{selectedEtape.penalite}% du score</small>
            </label>

            <div className="scenario-modal-actions">
              <button type="button" className="primary" onClick={() => setSelectedNode(null)}>
                Enregistrer
              </button>
              <button type="button" onClick={() => setSelectedNode(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminScenarioPage
