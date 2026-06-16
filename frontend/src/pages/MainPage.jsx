import { useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal' // (à créer si non existant)
import QrCodeLoader from '../components/QrCodeLoader'
import {
  ArrowUp,
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronDown,
  Bell,
  FolderOpen,
  Headset,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { componentCatalogService, generationService } from '../services/dataService'
import api, { adminService } from '../services/authService'
import { DISCOVERY_URL, QR_CONFIG_URL } from '../services/env'

const WORKFLOW_STORAGE_KEY = 'scenia-workflow-v1'

const WORKFLOW_STAGES = [
  {
    id: 'setup',
    title: 'Paramétrer un scénario',
    description: 'Sélection ou génération du scénario.',
  },
  {
    id: 'validation',
    title: 'Validation du scénario',
    description: 'Ajustements détaillés avant validation.',
  },
  {
    id: 'dashboard',
    title: 'Affectation apprenant',
    description: 'Associer le scénario généré à un apprenant et préparer son accès.',
  },
]

const STEP_TYPE_OPTIONS = [
  { value: 'briefing', label: 'Briefing' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'verification', label: 'Verification' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'debrief', label: 'Debrief' },
]

const STEP_OBJECT_ACTION_OPTIONS = [
  { value: 'ouvrir', label: 'Ouvrir' },
  { value: 'fermer', label: 'Fermer' },
  { value: 'verifier', label: 'Verifier' },
]

const DEFAULT_COMPOSANT_OPTIONS = []

function normalizeStateOptions(states) {
  const rawStates = Array.isArray(states)
    ? states
    : String(states || '').split(',')

  const normalized = rawStates
    .map((state) => String(state || '').trim())
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

function getEquipmentOptions(componentCatalogOptions = []) {
  return (componentCatalogOptions || [])
    .map((option) => {
      const value = String(option?.value || '').trim()
      if (!value) return null
      const states = normalizeStateOptions(option?.states)
      return {
        dbId: option?.dbId ?? null,
        value,
        label: String(option?.label || value).trim() || value,
        states,
      }
    })
    .filter(Boolean)
}

function normalizeComponentCatalogPayload(components = []) {
  return (components || [])
    .map((comp) => {
      const value = String(comp?.name || comp?.nom_composant || '').trim()
      if (!value) return null
      return {
        dbId: comp?.id ?? comp?.ID_composant ?? comp?.id_composant ?? null,
        value,
        label: String(comp?.label || comp?.nom_composant || value).trim() || value,
        states: normalizeStateOptions(comp?.etats_possibles || comp?.states),
      }
    })
    .filter(Boolean)
}

function resolveAccessUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  try {
    return new URL(pathOrUrl, window.location.origin).toString()
  } catch {
    return pathOrUrl
  }
}

function createDefaultTechnicalParameters() {
  return {
    etats_base_equipements: {},
  }
}

function normalizeInitialStateIntro(rawScenario) {
  const initialState = rawScenario?.etat_initial || rawScenario?.config || rawScenario?.initial_state || {}
  const existingIntro = rawScenario?.initial_state_intro || {}
  const typePoste =
    existingIntro.TYPE_POSTE ||
    initialState?.TYPE_POSTE ||
    initialState?.type_poste ||
    rawScenario?.environnement ||
    rawScenario?.environment ||
    rawScenario?.TYPE_POSTE ||
    ''

  return {
    TYPE_POSTE: String(typePoste || '').trim(),
    METEO: existingIntro.METEO ?? initialState?.METEO ?? initialState?.meteo ?? rawScenario?.METEO ?? 'NP',
    DEMANDE_CLIENT:
      existingIntro.DEMANDE_CLIENT ||
      initialState?.DEMANDE_CLIENT ||
      initialState?.demande_client ||
      rawScenario?.DEMANDE_CLIENT ||
      {},
  }
}

function normalizeBaseEquipmentState(value, fallback = '') {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'ouvert' || normalized === 'open') return 'ouvert'
  if (normalized === 'ferme' || normalized === 'fermée' || normalized === 'fermee' || normalized === 'closed') {
    return 'ferme'
  }
  return fallback
}

function normalizeRuntimeEquipmentState(value, fallback = '') {
  if (value === 1 || value === true) return 'ouvert'
  if (value === 0 || value === false) return 'ferme'
  return normalizeBaseEquipmentState(value, fallback)
}

function normalizeEquipmentStateForOptions(value, equipment, fallback = '') {
  const allowedStates = normalizeStateOptions(equipment?.states)
  const defaultState = allowedStates[0] || fallback
  const rawState = String(value || '').trim()
  if (!rawState) return defaultState

  const exactMatch = allowedStates.find((state) => state === rawState)
  if (exactMatch) return exactMatch

  const lowerMatch = allowedStates.find((state) => state.toLowerCase() === rawState.toLowerCase())
  if (lowerMatch) return lowerMatch

  return normalizeBaseEquipmentState(rawState, defaultState)
}

function toRuntimeEquipmentStateValue(state) {
  const normalized = String(state || '').trim().toLowerCase()
  if (normalized === 'ouvert' || normalized === 'open') return 1
  if (normalized === 'ferme' || normalized === 'fermee' || normalized === 'fermée' || normalized === 'closed') return 0
  return state
}

function normalizeTechnicalParameters(rawScenario, equipmentOptions = DEFAULT_COMPOSANT_OPTIONS) {
  const source = rawScenario?.parametres_techniques || rawScenario?.parametresTechniques || rawScenario?.technique || {}
  const rawEquipements = source.etats_base_equipements || source.equipements || rawScenario?.equipements || {}
  const initialState = rawScenario?.etat_initial || rawScenario?.config || rawScenario?.initial_state || {}
  const resolvedEquipmentOptions = getEquipmentOptions(equipmentOptions)

  const etatsBaseEquipements = resolvedEquipmentOptions.reduce((accumulator, equipment) => {
    const equipmentId = equipment.value
    const fallbackState = equipment.states[0] || ''
    const rawInitialState = initialState?.[equipmentId]
    const rawValue = rawInitialState !== undefined ? rawInitialState : rawEquipements?.[equipmentId]

    if (typeof rawValue === 'string') {
      accumulator[equipmentId] = normalizeEquipmentStateForOptions(rawValue, equipment, fallbackState)
      return accumulator
    }

    if (rawValue && typeof rawValue === 'object') {
      if (rawValue.ETAT !== undefined || rawValue.etat !== undefined) {
        const rawRuntimeState = rawValue.ETAT ?? rawValue.etat
        const runtimeState =
          typeof rawRuntimeState === 'number' || typeof rawRuntimeState === 'boolean'
            ? normalizeRuntimeEquipmentState(rawRuntimeState, fallbackState)
            : rawRuntimeState
        accumulator[equipmentId] = normalizeEquipmentStateForOptions(runtimeState, equipment, fallbackState)
        return accumulator
      }

      const directState = rawValue.etat_base || rawValue.etatBase || rawValue.etat || rawValue.state || rawValue.statut
      if (directState !== undefined) {
        const runtimeState =
          typeof directState === 'number' || typeof directState === 'boolean'
            ? normalizeRuntimeEquipmentState(directState, fallbackState)
            : directState
        accumulator[equipmentId] = normalizeEquipmentStateForOptions(runtimeState, equipment, fallbackState)
        return accumulator
      }

      const position = Number.parseFloat(rawValue.position)
      if (Number.isFinite(position)) {
        accumulator[equipmentId] = position >= 50 ? 'ouvert' : 'ferme'
        return accumulator
      }
    }

    accumulator[equipmentId] = fallbackState
    return accumulator
  }, {})

  return {
    etats_base_equipements: etatsBaseEquipements,
  }
}


function generateStepId() {
  return `step-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function clampDuration(value) {
  const duration = Number(value)
  if (!Number.isFinite(duration) || duration < 1) return 1
  return Math.round(duration)
}

function toValidOption(value, options, fallback) {
  const exists = options.some((option) => option.value === value)
  return exists ? value : fallback
}

function normalizeComponent3dId(value, fallback) {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function buildAllowedComponentSet(componentOptions = []) {
  return new Set(
    (componentOptions || [])
      .map((option) => String(option?.value || '').trim())
      .filter(Boolean),
  )
}

function normalizeTargetsByAllowedComponents(targets, allowedComponentIds) {
  if (!allowedComponentIds || allowedComponentIds.size === 0) return targets
  return targets.filter((target) => allowedComponentIds.has(String(target.component3dId || '').trim()))
}

function normalizeStepObjectAction(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (/\b(ouvrir|open)\b/.test(normalized)) return 'ouvrir'
  if (/\b(fermer|fermee|fermée|closed|close)\b/.test(normalized)) return 'fermer'
  return 'verifier'
}

function createStepObjectTarget(component3dId, action = 'verifier') {
  return {
    id: generateStepId(),
    component3dId: normalizeComponent3dId(component3dId, ''),
    action: normalizeStepObjectAction(action),
  }
}

function normalizeStepObjectTargets(step, vrFallback = '', allowedComponentIds = new Set()) {
  const source = Array.isArray(step?.objectTargets)
    ? step.objectTargets
    : Array.isArray(step?.actions_objets)
      ? step.actions_objets
      : Array.isArray(step?.actions)
        ? step.actions
        : []

  const normalizedTargets = source
    .map((target) => {
      if (typeof target === 'string') {
        const rawValue = target.trim()
        const actionMatch = rawValue.match(/\b(ouvrir|fermer|verifier|open|close)\b/i)
        const actionValue = actionMatch ? actionMatch[1] : 'verifier'
        const componentCandidate = rawValue.replace(/\b(ouvrir|fermer|verifier|open|close)\b/gi, '').trim()
        const component3dId = normalizeComponent3dId(componentCandidate || rawValue, '')
        if (!component3dId) return null
        return createStepObjectTarget(component3dId, actionValue)
      }

      if (!target || typeof target !== 'object') return null

      const component3dId = normalizeComponent3dId(
        target.component3dId || target.vr_element || target.vrElement || target.objet || target.object || target.target || target.cible || target.name,
        '',
      )

      if (!component3dId) return null

      const actionValue = target.action || target.action_type || target.actionType || target.type || target.actionType || 'verifier'
      return createStepObjectTarget(component3dId, actionValue)
    })
    .filter(Boolean)

  const filteredTargets = normalizeTargetsByAllowedComponents(normalizedTargets, allowedComponentIds)
  if (filteredTargets.length > 0) return filteredTargets

  const fallbackComponent = normalizeComponent3dId(
    step?.vr_element || step?.vrElement || step?.component3dId,
    vrFallback,
  )

  if (fallbackComponent && (!allowedComponentIds || allowedComponentIds.size === 0 || allowedComponentIds.has(fallbackComponent))) {
    return [createStepObjectTarget(fallbackComponent, step?.action)]
  }

  return []
}

function normalizeScenarioStep(step, index, vrFallback = '', allowedComponentIds = new Set()) {
  const rawLabel =
    typeof step === 'string'
      ? step
      : step?.titre || step?.title || step?.nom || step?.label || `étape ${index + 1}`

  const rawDescription = typeof step === 'string' ? '' : step?.description || step?.instructions || ''
  const rawDuration = typeof step === 'string' ? 8 : step?.duree_estimee || step?.duree_minutes || step?.duree || 8
  const rawType = typeof step === 'string' ? 'instruction' : step?.type || step?.categorie || 'instruction'
  const objectTargets = normalizeStepObjectTargets(step, vrFallback, allowedComponentIds)
  const primaryComponent3dId = objectTargets[0]?.component3dId || normalizeComponent3dId(vrFallback, '')

  return {
    id: generateStepId(),
    label: rawLabel,
    description: rawDescription,
    duration: clampDuration(rawDuration),
    type: toValidOption(rawType, STEP_TYPE_OPTIONS, 'instruction'),
    vrElement: primaryComponent3dId,
    objectTargets,
  }
}

function normalizeScenarioDraft(rawScenario, vrFallback = '', componentCatalogOptions = []) {
  const allowedComponentIds = buildAllowedComponentSet(componentCatalogOptions)
  const equipmentOptions = getEquipmentOptions(componentCatalogOptions)
  const rawSteps = Array.isArray(rawScenario?.etapes) ? rawScenario.etapes : []
  const steps = rawSteps.map((step, index) => normalizeScenarioStep(step, index, vrFallback, allowedComponentIds))
  const initialIntro = normalizeInitialStateIntro(rawScenario)

  return {
    titre: rawScenario?.titre || 'scénario genere',
    description: rawScenario?.description || '',
    difficulte: rawScenario?.difficulte || 'intermediaire',
    duree_totale: clampDuration(rawScenario?.duree_totale || steps.reduce((acc, step) => acc + step.duration, 0) || 30),
    etapes: steps.length > 0 ? steps : [normalizeScenarioStep('étape initiale', 0, vrFallback, allowedComponentIds)],
    environnement: initialIntro.TYPE_POSTE,
    initial_state_intro: initialIntro,
    parametres_techniques: normalizeTechnicalParameters(rawScenario, equipmentOptions),
  }
}

function buildScenarioPayload(draft, componentCatalogOptions = []) {
  const technicalParameters = draft?.parametres_techniques || createDefaultTechnicalParameters()
  const allowedComponentIds = buildAllowedComponentSet(componentCatalogOptions)
  const equipmentOptions = getEquipmentOptions(componentCatalogOptions)
  const initialIntro = draft?.initial_state_intro || {}
  const typePoste = String(initialIntro.TYPE_POSTE || draft?.environnement || '').trim()

  return {
    titre: draft.titre,
    description: draft.description,
    difficulte: draft.difficulte,
    duree_totale: clampDuration(draft.duree_totale),
    environnement: typePoste,
    etapes: draft.etapes.map((step, index) => {
      const normalizedTargets = normalizeStepObjectTargets(step, step.vrElement || '', allowedComponentIds)
      const primaryComponent3dId = normalizedTargets[0]?.component3dId || ''

      return {
        ordre: index + 1,
        titre: step.label,
        description: step.description,
        type: step.type,
        vr_element: primaryComponent3dId,
        actions_objets: normalizedTargets.map((target) => ({
          vr_element: target.component3dId,
          action: target.action,
        })),
        duree_estimee: clampDuration(step.duration),
      }
    }),
    parametres_techniques: {
      etats_base_equipements: equipmentOptions.reduce((accumulator, equipment) => {
        const equipmentId = equipment.value
        accumulator[equipmentId] = normalizeEquipmentStateForOptions(
          technicalParameters.etats_base_equipements?.[equipmentId],
          equipment,
          equipment.states[0] || '',
        )
        return accumulator
      }, {}),
    },
    etat_initial: equipmentOptions.reduce((accumulator, equipment) => {
      const equipmentId = equipment.value
      const state = normalizeEquipmentStateForOptions(
        technicalParameters.etats_base_equipements?.[equipmentId],
        equipment,
        equipment.states[0] || '',
      )
      accumulator[equipmentId] = {
        STATUT: 1,
        ETAT: toRuntimeEquipmentStateValue(state),
      }
      return accumulator
    }, {
      ...(typePoste ? { TYPE_POSTE: typePoste } : {}),
      METEO: initialIntro.METEO ?? 'NP',
      DEMANDE_CLIENT: initialIntro.DEMANDE_CLIENT || {},
    }),
  }
}

function buildTimelineFromDraft(draft, componentCatalogOptions = []) {
  const allowedComponentIds = buildAllowedComponentSet(componentCatalogOptions)
  return draft.etapes.map((step, index) => {
    const normalizedTargets = normalizeStepObjectTargets(step, step.vrElement || '', allowedComponentIds)

    return {
      id: generateStepId(),
      label: step.label,
      description: step.description,
      duration: step.duration,
      type: step.type,
      vrElement: normalizedTargets[0]?.component3dId || '',
      status: index === 0 ? 'active' : 'pending',
    }
  })
}

function resolveScenarioProcedure(scenario) {
  if (!scenario || typeof scenario !== 'object') return '-'

  const candidates = [
    scenario.procedure,
    scenario.procedure_reference,
    scenario.procedure_de_reference,
    scenario.procedures,
    scenario.objectif,
    scenario.objectif_pedagogique,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const value = candidate.filter(Boolean).join(', ')
      if (value.trim()) return value
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return '-'
}

function resolveScenarioDocuments(item) {
  const sources = Array.isArray(item?.rag_sources) ? item.rag_sources : []
  const names = sources
    .map((source) => String(source?.title || source?.name || '').trim())
    .filter(Boolean)

  const uniqueNames = Array.from(new Set(names))
  return uniqueNames.length > 0 ? uniqueNames.join(', ') : 'Aucun document'
}

function resolveScenarioDuration(scenario) {
  if (!scenario || typeof scenario !== 'object') return '-'
  const direct = Number(scenario.duree_totale)
  if (Number.isFinite(direct) && direct > 0) {
    return `${Math.round(direct)} min`
  }

  const steps = Array.isArray(scenario.etapes) ? scenario.etapes : []
  const seconds = steps.reduce((sum, step) => sum + Number(step?.duree_estimee || step?.duree || 0), 0)
  if (seconds > 0) {
    return `${Math.max(1, Math.round(seconds / 60))} min`
  }

  return '-'
}

function formatScenarioDate(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return '-'
  }
}

function MainPage() {
  // Correction : gestion de la modale QR code
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  // Génération dynamique de l'URL du QR code pour l'endpoint /config
  const [qrCodeUrl, setQrCodeUrl] = useState(QR_CONFIG_URL)

  const [componentCatalogOptions, setVrEnvOptions] = useState(DEFAULT_COMPOSANT_OPTIONS)
  const defaultVrValue = componentCatalogOptions[0]?.value || ''

  const [workflowStage, setWorkflowStage] = useState('setup')
  const [scenarioValidated, setScenarioValidated] = useState(false)
  const [setupPrompt, setSetupPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [desiredSteps, setDesiredSteps] = useState(4)

  const [scenarioLibraryItems, setScenarioLibraryItems] = useState([])
  const [scenarioLibraryLoading, setScenarioLibraryLoading] = useState(true)
  const [scenarioLibraryError, setScenarioLibraryError] = useState('')
  const [setupMode, setSetupMode] = useState('new')
  const [openFilterColumn, setOpenFilterColumn] = useState('')
  const [columnFilters, setColumnFilters] = useState({
    id: [],
    title: [],
    date: [],
    procedure: [],
    duration: [],
  })
  const [columnSearch, setColumnSearch] = useState({
    id: '',
    title: '',
    date: '',
    procedure: '',
    duration: '',
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const [workflowNotice, setWorkflowNotice] = useState({ type: '', text: '' })
  const [scenarioDraft, setScenarioDraft] = useState(null)
  const [savedScenarioId, setSavedScenarioId] = useState(null)
  const [currentGenerationId, setCurrentGenerationId] = useState(null)
  const [assignedAccess, setAssignedAccess] = useState(null)

  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [timeline, setTimeline] = useState([])

  const [setupConversation, setSetupConversation] = useState([
    {
      type: 'assistant',
      text: 'Décrivez votre besoin de formation pour générer un scénario adapté.',
    },
  ])
  

  const [toastMessage, setToastMessage] = useState('')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [isToastFading, setIsToastFading] = useState(false)

  const refreshComponentCatalog = async () => {
    try {
      const payload = await componentCatalogService.getAvailable()
      const components = Array.isArray(payload?.components) ? payload.components : []

      const nextCatalogOptions = normalizeComponentCatalogPayload(components)
      setVrEnvOptions(nextCatalogOptions)
      setScenarioDraft((previous) => (
        previous
          ? normalizeScenarioDraft(previous, nextCatalogOptions[0]?.value || '', nextCatalogOptions)
          : previous
      ))
    } catch {
      setVrEnvOptions(DEFAULT_COMPOSANT_OPTIONS)
    }
  }

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedState = localStorage.getItem(WORKFLOW_STORAGE_KEY)
        if (savedState) {
          const parsedState = JSON.parse(savedState)

          if (parsedState?.workflowStage) setWorkflowStage(parsedState.workflowStage)
          if (typeof parsedState?.scenarioValidated === 'boolean') {
            setScenarioValidated(parsedState.scenarioValidated)
          }
          if (parsedState?.setupPrompt) setSetupPrompt(parsedState.setupPrompt)
          if (typeof parsedState?.temperature === 'number') setTemperature(parsedState.temperature)
          if (typeof parsedState?.desiredSteps === 'number') setDesiredSteps(parsedState.desiredSteps)
          if (parsedState?.scenarioDraft) {
            setScenarioDraft(normalizeScenarioDraft(parsedState.scenarioDraft, '', DEFAULT_COMPOSANT_OPTIONS))
          }
          if (Array.isArray(parsedState?.timeline)) setTimeline(parsedState.timeline)
          if (Array.isArray(parsedState?.setupConversation)) {
            setSetupConversation(parsedState.setupConversation)
          }
          if (parsedState?.selectedLearnerId) setSelectedLearnerId(parsedState.selectedLearnerId)
          if (parsedState?.currentGenerationId) setCurrentGenerationId(parsedState.currentGenerationId)
        }
      } catch {
        localStorage.removeItem(WORKFLOW_STORAGE_KEY)
      }

      await refreshComponentCatalog()
    }

    restoreSession()
  }, [])

  useEffect(() => {
    const handleCatalogUpdated = () => {
      refreshComponentCatalog()
    }

    window.addEventListener('scenia:component-catalog-updated', handleCatalogUpdated)
    window.addEventListener('focus', handleCatalogUpdated)
    return () => {
      window.removeEventListener('scenia:component-catalog-updated', handleCatalogUpdated)
      window.removeEventListener('focus', handleCatalogUpdated)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadLearners = async () => {
      try {
        const payload = await adminService.getUsers({ role: 'apprenant', limit: 100, skip: 0 })
        const users = Array.isArray(payload?.users) ? payload.users : []
        const mappedLearners = users.map((user) => ({
          id: String(user.ID_utilisateur),
          nom: user.nom || '',
          prenom: user.prenom || '',
          email: user.email || '',
          role: user.role || 'apprenant',
          headset: 'À préparer',
          phase: 'En attente d attribution',
          scenarioSessionStatus: 'pending',
          assignedScenarioTitle: '',
          assignedScenarioId: '',
          assignedAt: '',
          notification: null,
        }))

        if (mounted) {
          setLearners(mappedLearners)
          setSelectedLearnerId((previous) => {
            if (previous && mappedLearners.some((learner) => learner.id === previous)) return previous
            return mappedLearners[0]?.id || ''
          })
        }
      } catch {
        if (mounted) {
          setLearners([])
          setSelectedLearnerId('')
        }
      }
    }

    loadLearners()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadLibrary = async () => {
      setScenarioLibraryLoading(true)
      setScenarioLibraryError('')
      try {
        const payload = await generationService.getLibrary({ limit: 12, offset: 0 })
        if (mounted) {
          setScenarioLibraryItems(payload.items || [])
        }
      } catch (error) {
        if (mounted) {
          const detail = error?.response?.data?.detail || error?.message || 'Impossible de charger la bibliotheque.'
          setScenarioLibraryError(detail)
        }
      } finally {
        if (mounted) {
          setScenarioLibraryLoading(false)
        }
      }
    }

    loadLibrary()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const loadDiscovery = async () => {
      try {
        const response = await fetch(DISCOVERY_URL)
        if (!response.ok) return
        const payload = await response.json()
        const host = payload?.ip
        const port = payload?.port
        if (!host) return
        const scheme = window.location.protocol === 'https:' ? 'https' : 'http'
        const resolvedBaseUrl = port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`
        if (isActive) {
          setQrCodeUrl(`${resolvedBaseUrl}/api/v1/config`)
        }
      } catch {
        setQrCodeUrl(QR_CONFIG_URL)
      }
    }

    loadDiscovery()

    return () => {
      isActive = false
    }
  }, [])

  const componentOptions = useMemo(() => {
    const optionMap = new Map()

    const addOption = (value, label = value) => {
      const normalizedValue = String(value || '').trim()
      if (!normalizedValue) return
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, {
          value: normalizedValue,
          label: String(label || normalizedValue).trim() || normalizedValue,
        })
      }
    }

    // Les composants 3D sont chargés dynamiquement depuis la BD, pas de liste par défaut
    componentCatalogOptions.forEach((option) => addOption(option.value, option.label))

    return Array.from(optionMap.values())
  }, [componentCatalogOptions])

  const equipmentOptions = useMemo(
    () => getEquipmentOptions(componentCatalogOptions),
    [componentCatalogOptions],
  )

  useEffect(() => {
    const serializableState = {
      workflowStage,
      scenarioValidated,
      setupPrompt,
      temperature,
      desiredSteps,
      scenarioDraft,
      timeline,
      setupConversation,
      selectedLearnerId,
      currentGenerationId,
    }
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(serializableState))
  }, [
    workflowStage,
    scenarioValidated,
    setupPrompt,
    temperature,
    desiredSteps,
    scenarioDraft,
    timeline,
    setupConversation,
    selectedLearnerId,
    currentGenerationId,
  ])

  useEffect(() => {
    if (!isToastVisible) return undefined
    setIsToastFading(false)
    const fadeTimeoutId = window.setTimeout(() => {
      setIsToastFading(true)
    }, 1800)
    const timeoutId = window.setTimeout(() => {
      setIsToastVisible(false)
    }, 2400)
    return () => {
      window.clearTimeout(fadeTimeoutId)
      window.clearTimeout(timeoutId)
    }
  }, [isToastVisible, toastMessage])

  useEffect(() => {
    if (timeline.length === 0) return

    const activeStepCount = timeline.filter((step) => step.status === 'active').length
    if (activeStepCount <= 1) return

    setTimeline((previous) => {
      let activeSeen = false
      return previous.map((step) => {
        if (step.status !== 'active') return step
        if (!activeSeen) {
          activeSeen = true
          return step
        }
        return { ...step, status: 'pending' }
      })
    })
  }, [timeline])

  const selectedLearner = useMemo(
    () => learners.find((learner) => learner.id === selectedLearnerId) || learners[0],
    [selectedLearnerId, learners],
  )

  const currentStageIndex = useMemo(
    () => WORKFLOW_STAGES.findIndex((stage) => stage.id === workflowStage),
    [workflowStage],
  )

  const stageMeta = WORKFLOW_STAGES[currentStageIndex] || WORKFLOW_STAGES[0]
  const currentScenarioTitle = scenarioDraft?.titre || stageMeta.title

  const pendingLearnerSessions = useMemo(
    () => learners.filter((learner) => learner.scenarioSessionStatus === 'pending'),
    [learners],
  )
  const activeLearnerSessions = useMemo(
    () => learners.filter((learner) => ['active', 'done'].includes(learner.scenarioSessionStatus)),
    [learners],
  )

  const scenarioRows = useMemo(() => {
    return scenarioLibraryItems.map((item, index) => {
      const scenario = item?.scenario || {}
      return {
        id: String(item?.generation_id ?? item?.scenario_id ?? `row-${index}`),
        title: item?.titre || scenario?.titre || 'Scenario sans titre',
        date: formatScenarioDate(item?.created_at),
        procedure: resolveScenarioProcedure(scenario),
        documents: resolveScenarioDocuments(item),
        duration: resolveScenarioDuration(scenario),
        item,
      }
    })
  }, [scenarioLibraryItems])

  const columnFilterOptions = useMemo(() => {
    const unique = (values) => Array.from(new Set(values.filter((value) => value !== undefined && value !== null)))

    return {
      id: unique(scenarioRows.map((row) => row.id)),
      title: unique(scenarioRows.map((row) => row.title)),
      date: unique(scenarioRows.map((row) => row.date)),
      procedure: unique(scenarioRows.map((row) => row.procedure)),
      duration: unique(scenarioRows.map((row) => row.duration)),
    }
  }, [scenarioRows])

  const filteredScenarioRows = useMemo(() => {
    const matches = (value, selected) => selected.length === 0 || selected.includes(value)

    return scenarioRows.filter((row) => (
      matches(row.id, columnFilters.id) &&
      matches(row.title, columnFilters.title) &&
      matches(row.date, columnFilters.date) &&
      matches(row.procedure, columnFilters.procedure) &&
      matches(row.duration, columnFilters.duration)
    ))
  }, [columnFilters, scenarioRows])

  const toggleFilterMenu = (columnKey) => {
    setOpenFilterColumn((previous) => (previous === columnKey ? '' : columnKey))
  }

  const updateColumnSearch = (columnKey, value) => {
    setColumnSearch((previous) => ({
      ...previous,
      [columnKey]: value,
    }))
  }

  const isOptionSelected = (columnKey, option, options) => {
    const selected = columnFilters[columnKey] || []
    const effective = selected.length === 0 ? options : selected
    return effective.includes(option)
  }

  const toggleFilterOption = (columnKey, option, options) => {
    setColumnFilters((previous) => {
      const selected = previous[columnKey] || []
      const effective = selected.length === 0 ? options : selected
      const next = new Set(effective)

      if (next.has(option)) {
        next.delete(option)
      } else {
        next.add(option)
      }

      const nextList = Array.from(next)
      return {
        ...previous,
        [columnKey]: nextList.length === options.length ? [] : nextList,
      }
    })
  }

  const clearColumnFilter = (columnKey) => {
    setColumnFilters((previous) => ({
      ...previous,
      [columnKey]: [],
    }))
  }

  const getFilteredOptions = (columnKey, options) => {
    const query = String(columnSearch[columnKey] || '').toLowerCase()
    if (!query) return options
    return options.filter((option) => String(option || '').toLowerCase().includes(query))
  }

  const handleUseLibraryScenario = (item) => {
    const scenario = item?.scenario
    if (!scenario || !Array.isArray(scenario.etapes) || scenario.etapes.length === 0) {
      setWorkflowNotice({ type: 'error', text: 'Ce scenario ne contient pas de donnees exploitables.' })
      return
    }

    const normalizedDraft = normalizeScenarioDraft(scenario, defaultVrValue, componentCatalogOptions)
    setScenarioDraft(normalizedDraft)
    setCurrentGenerationId(item?.generation_id || null)
    setScenarioValidated(false)
    setTimeline([])
    setWorkflowStage('validation')
    setToastMessage('Scenario charge. Vous pouvez maintenant le valider.')
    setIsToastVisible(true)
  }

  const handleDeleteLibraryScenario = async (item) => {
    const scenarioId = item?.scenario_id
    const scenarioTitle = item?.titre || item?.scenario?.titre || 'ce scenario'

    if (!scenarioId) {
      setWorkflowNotice({ type: 'error', text: 'Impossible de supprimer ce scenario: identifiant manquant.' })
      return
    }

    const confirmed = window.confirm(`Etes-vous sur de vouloir supprimer "${scenarioTitle}" de la base de donnees ?`)
    if (!confirmed) return

    try {
      await generationService.deleteScenario(scenarioId)
      setScenarioLibraryItems((previous) => previous.filter((libraryItem) => libraryItem?.scenario_id !== scenarioId))
      setWorkflowNotice({ type: 'success', text: 'Scenario supprime de la base de donnees.' })
      setToastMessage('Scenario supprime.')
      setIsToastVisible(true)
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Impossible de supprimer le scenario.'
      setWorkflowNotice({ type: 'error', text: detail })
    }
  }

  const handleGenerateScenario = async (promptText = setupPrompt) => {
    const normalizedPrompt = String(promptText || '').trim()

    if (!normalizedPrompt) {
      setWorkflowNotice({ type: 'error', text: 'Décrivez la formation avant de generer le scénario.' })
      return
    }

    setIsGenerating(true)
    setWorkflowNotice({ type: '', text: '' })

    try {
      const response = await api.post('/api/v1/scenario/generate', {
        topic: normalizedPrompt,
        custom_prompt: '',
        store: true,
      })

      const generatedScenario = response.data?.scenario_json
      if (!generatedScenario) {
        throw new Error('Le scénario genere est vide.')
      }

      if (generatedScenario.titre === 'Erreur de génération') {
        throw new Error(generatedScenario.description || 'Le moteur IA n a pas pu generer un scénario valide.')
      }

      const normalizedDraft = normalizeScenarioDraft(generatedScenario, defaultVrValue, componentCatalogOptions)
      setScenarioDraft(normalizedDraft)
      setCurrentGenerationId(response.data?.scenario_id || null)
      setToastMessage('Scénario généré. Vous pouvez maintenant le valider.')
      setIsToastVisible(true)
      setSetupConversation((previous) => [
        ...previous,
        {
          type: 'assistant',
          text: `scénario genere avec ${normalizedDraft.etapes.length} étape(s). Passage a la validation.`,
        },
      ])
      setWorkflowStage('validation')
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Erreur lors de la génération.'
      setWorkflowNotice({ type: 'error', text: detail })
      setSetupConversation((previous) => [
        ...previous,
        {
          type: 'assistant-error',
          text: detail,
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const submitSetupPrompt = () => {
    if (isGenerating) return

    const normalizedPrompt = setupPrompt.trim()
    if (!normalizedPrompt) return

    setSetupConversation((previous) => [
      ...previous,
      {
        type: 'user',
        text: normalizedPrompt,
      },
    ])

    setSetupPrompt('')
    handleGenerateScenario(normalizedPrompt)
  }

  const updateScenarioField = (field, value) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      return { ...previous, [field]: value }
    })
  }

  const updateTechnicalEquipmentState = (equipmentId, value) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      const currentTechnical = previous.parametres_techniques || createDefaultTechnicalParameters()
      return {
        ...previous,
        parametres_techniques: {
          ...currentTechnical,
          etats_base_equipements: {
            ...currentTechnical.etats_base_equipements,
            [equipmentId]: value,
          },
        },
      }
    })
  }

  const updateScenarioStep = (stepId, field, value) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        etapes: previous.etapes.map((step) => {
          if (step.id !== stepId) return step
          if (field === 'duration') return { ...step, duration: clampDuration(value) }
          if (field === 'vrElement') {
            const currentTargets = normalizeStepObjectTargets(step, defaultVrValue)
            const nextFirstTarget = {
              ...currentTargets[0],
              component3dId: normalizeComponent3dId(value, defaultVrValue),
            }
            return {
              ...step,
              vrElement: nextFirstTarget.component3dId,
              objectTargets: [nextFirstTarget, ...currentTargets.slice(1)],
            }
          }
          return { ...step, [field]: value }
        }),
      }
    })
  }

  const updateScenarioStepObjectTarget = (stepId, targetIndex, field, value) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        etapes: previous.etapes.map((step) => {
          if (step.id !== stepId) return step

          const currentTargets = normalizeStepObjectTargets(step, defaultVrValue)
          const nextTargets = currentTargets.map((target) => {
            if (currentTargets.indexOf(target) !== targetIndex) return target

            if (field === 'action') {
              return { ...target, action: normalizeStepObjectAction(value) }
            }

            return { ...target, component3dId: normalizeComponent3dId(value, '') }
          })

          return {
            ...step,
            vrElement: nextTargets[0]?.component3dId || '',
            objectTargets: nextTargets,
          }
        }),
      }
    })
  }

  const addScenarioStepObjectTarget = (stepId) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        etapes: previous.etapes.map((step) => {
          if (step.id !== stepId) return step

          const currentTargets = normalizeStepObjectTargets(step, defaultVrValue)
          const nextTargets = [...currentTargets, createStepObjectTarget(defaultVrValue, 'verifier')]

          return {
            ...step,
            vrElement: nextTargets[0]?.component3dId || '',
            objectTargets: nextTargets,
          }
        }),
      }
    })
  }

  const removeScenarioStepObjectTarget = (stepId, targetIndex) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        etapes: previous.etapes.map((step) => {
          if (step.id !== stepId) return step

          const currentTargets = normalizeStepObjectTargets(step, defaultVrValue)
          if (currentTargets.length <= 1) return step

          const nextTargets = currentTargets.filter((_, index) => index !== targetIndex)

          return {
            ...step,
            vrElement: nextTargets[0]?.component3dId || '',
            objectTargets: nextTargets,
          }
        }),
      }
    })
  }

  const addScenarioStep = () => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      const nextStepNumber = previous.etapes.length + 1
      return {
        ...previous,
        etapes: [
          ...previous.etapes,
          {
            id: generateStepId(),
            label: `étape ${nextStepNumber}`,
            description: '',
            duration: 8,
            type: STEP_TYPE_OPTIONS[1].value,
            vrElement: defaultVrValue,
            objectTargets: [createStepObjectTarget(defaultVrValue, 'verifier')],
          },
        ],
      }
    })
  }

  const removeScenarioStep = (stepId) => {
    setScenarioDraft((previous) => {
      if (!previous) return previous
      if (previous.etapes.length <= 1) return previous
      return {
        ...previous,
        etapes: previous.etapes.filter((step) => step.id !== stepId),
      }
    })
  }

  const validateScenario = async () => {
    if (!scenarioDraft) {
      setWorkflowNotice({ type: 'error', text: 'Aucun scénario à valider.' })
      return
    }
    if (!scenarioDraft.etapes || scenarioDraft.etapes.length === 0) {
      setWorkflowNotice({ type: 'error', text: 'Ajoutez au moins une étape avant validation.' })
      return
    }
    setIsValidating(true)
    setWorkflowNotice({ type: '', text: '' })
    try {
      const payload = buildScenarioPayload(scenarioDraft, componentCatalogOptions)
      const saveResponse = await api.post('/api/v1/scenario/save', payload)
      const scenarioId = saveResponse.data?.scenario_id
      if (scenarioId) {
        setSavedScenarioId(scenarioId)
      }
      // Génère la timeline et met à jour les apprenants
      const timelineFromScenario = buildTimelineFromDraft(scenarioDraft, componentCatalogOptions)
      setTimeline(timelineFromScenario)
      setLearners((prev) => prev.map((l) => ({ ...l, phase: `étape 1 / ${timelineFromScenario.length || 1}` })))
      setScenarioValidated(true)
      // Utilise un setTimeout pour garantir le rendu avant de changer d'étape
      setTimeout(() => {
        setWorkflowStage('dashboard')
        setToastMessage('Scénario validé. Passage au tableau de bord.')
        setIsToastVisible(true)
      }, 0)
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Validation impossible.'
      setWorkflowNotice({ type: 'error', text: detail })
    } finally {
      setIsValidating(false)
    }
  }


  const assignScenarioToLearner = async () => {
    if (!scenarioDraft || !selectedLearner) {
      setWorkflowNotice({ type: 'error', text: 'Sélectionnez un apprenant et un scénario avant l association.' })
      return
    }
    if (!savedScenarioId) {
      setWorkflowNotice({ type: 'error', text: 'Validez le scénario avant de l associer à un apprenant.' })
      return
    }

    setWorkflowNotice({ type: '', text: '' })

    try {
      const response = await api.post('/api/v1/assignments', {
        user_id: Number(selectedLearner.id),
        scenario_id: Number(savedScenarioId),
      })
      const assignment = response.data || {}
      const assignedAt = assignment.created_at || new Date().toISOString()

      setAssignedAccess({
        session_id: assignment.session_id,
        scenario_id: assignment.scenario_id,
        qr_url: resolveAccessUrl(assignment.qr_url),
        config_url: resolveAccessUrl(assignment.config_url),
        learnerName: `${selectedLearner.prenom} ${selectedLearner.nom}`.trim(),
      })

      setLearners((previous) =>
        previous.map((learner) => {
          if (learner.id !== selectedLearner.id) return learner

          return {
            ...learner,
            phase: `Scénario attribué`,
            assignedScenarioTitle: currentScenarioTitle,
            assignedScenarioId: savedScenarioId,
            scenarioSessionStatus: 'pending',
            assignedAt,
            notification: {
              title: 'Nouveau scénario disponible',
              message: `Le scénario "${currentScenarioTitle}" est disponible sur votre tableau de bord.`,
              unread: true,
              createdAt: assignedAt,
            },
          }
        }),
      )

      setToastMessage(`Scénario associé à ${selectedLearner.prenom} ${selectedLearner.nom}.`)
      setIsToastVisible(true)
      setIsQrModalOpen(true)
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Association impossible.'
      setWorkflowNotice({ type: 'error', text: detail })
    }
  }

  const renderLearnerSessionCard = (learner) => (
    <div key={learner.id} className="rounded border border-black/10 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-black/80">{learner.prenom} {learner.nom}</p>
          <p className="text-xs text-black/50 mt-0.5">{learner.email || 'Apprenant existant'}</p>
        </div>
        <span className="text-xs text-black/50 whitespace-nowrap">{learner.headset}</span>
      </div>
      <div className="mt-2 text-xs text-black/60 space-y-1">
        <p>{learner.assignedScenarioTitle || 'En attente d attribution'}</p>
        <p>{learner.phase}</p>
      </div>
    </div>
  )


  const stageCanBeOpened = (stageId) => {
    if (stageId === 'setup') return true
    if (stageId === 'validation') return Boolean(scenarioDraft)
    if (stageId === 'dashboard') return scenarioValidated
    return false
  }

  const goToStage = (stageId) => {
    if (!stageCanBeOpened(stageId)) return
    setWorkflowStage(stageId)
  }

  const renderNotice = () => {
    if (!workflowNotice.text) return null

    if (workflowNotice.type === 'success') return null

    return (
      <div
        className="mt-4 border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-start gap-2"
      >
        <AlertCircle className="h-4 w-4 mt-0.5" />
        <span>{workflowNotice.text}</span>
      </div>
    )
  }

  return (
    <div className="page-enter flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="mt-3 grid grid-cols-3 gap-3">
          {WORKFLOW_STAGES.map((stage, index) => {
            const isActive = stage.id === workflowStage
            const canOpen = stageCanBeOpened(stage.id)

            return (
              <button
                key={stage.id}
                type="button"
                disabled={!canOpen}
                onClick={() => goToStage(stage.id)}
                className={`text-left rounded-xl border px-4 py-3 transition-colors duration-150 ${
                  isActive
                    ? 'border-[#e63641]/40 bg-[#e63641]/10 text-[#e63641]'
                    : canOpen
                      ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.14em]">Etape {index + 1}</p>
                <p className="text-sm font-semibold mt-1">{stage.title}</p>
              </button>
            )
          })}
        </div>
      </div>

      {renderNotice()}

      {workflowStage === 'setup' && (
        <div className="mt-6">
          <section className="panel-surface p-5 flex flex-col min-h-[72vh]">
            <div className="-mx-5 -mt-5 mb-4">
              <div className="bg-[#fafafa] border-b border-black/10 overflow-hidden rounded-t-2xl">
                <div className="grid grid-cols-2 divide-x divide-black/10">
                  <div
                    className={
                      setupMode === 'new'
                        ? 'p-[1px] bg-gradient-to-r from-[#e63641] via-[#f07c82] to-[#e63641] rounded-tl-2xl overflow-hidden'
                        : 'p-[1px] bg-transparent rounded-tl-2xl'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSetupMode('new')}
                      className={`w-full h-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors rounded-tl-2xl rounded-tr-none rounded-b-none ${
                        setupMode === 'new'
                          ? 'bg-white text-[#e63641]'
                          : 'bg-transparent text-black/40 hover:text-black/60'
                      }`}
                      aria-pressed={setupMode === 'new'}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generer un nouveau scenario
                    </button>
                  </div>

                  <div
                    className={
                      setupMode === 'history'
                        ? 'p-[1px] bg-gradient-to-r from-[#e63641] via-[#f07c82] to-[#e63641] rounded-tr-2xl overflow-hidden'
                        : 'p-[1px] bg-transparent rounded-tr-2xl'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSetupMode('history')}
                      className={`w-full h-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors rounded-tr-2xl rounded-tl-none rounded-b-none ${
                        setupMode === 'history'
                          ? 'bg-white text-[#e63641]'
                          : 'bg-transparent text-black/40 hover:text-black/60'
                      }`}
                      aria-pressed={setupMode === 'history'}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Historique des scenarios
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {setupMode === 'new' ? (
              <div className="mt-4 flex-1 flex flex-col">
                <div className="border border-black/15 bg-[#fcfcfc] p-4 flex-1 overflow-auto space-y-3">
                {setupConversation.map((message, index) => {
                  if (message.type === 'user') {
                    return (
                      <div key={`setup-msg-${index}`} className="flex justify-end message-enter" style={{ animationDelay: `${index * 20}ms` }}>
                        <div className="max-w-[88%] bg-red-600 text-white px-3 py-3">
                          <p className="text-xs uppercase tracking-wide opacity-85">Vous</p>
                          <p className="text-sm mt-1">{message.text}</p>
                        </div>
                      </div>
                    )
                  }

                  if (message.type === 'assistant-error') {
                    return (
                      <div key={`setup-msg-${index}`} className="flex justify-start message-enter" style={{ animationDelay: `${index * 20}ms` }}>
                        <div className="max-w-[88%] border border-red-200 bg-red-50 text-red-700 px-3 py-3">
                          <p className="text-xs uppercase tracking-wide">IA</p>
                          <p className="text-sm mt-1">{message.text}</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={`setup-msg-${index}`} className="flex justify-start message-enter" style={{ animationDelay: `${index * 20}ms` }}>
                      <div className="max-w-[88%] border border-black/20 bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-black/65">IA</p>
                        <p className="text-sm mt-1">{message.text}</p>
                      </div>
                    </div>
                  )
                })}

                {isGenerating && (
                  <div className="flex justify-start message-enter">
                    <div className="max-w-[88%] border border-black/20 bg-white px-3 py-3 inline-flex items-center gap-2 text-sm text-black/70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Génération du scénario en cours...
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-end gap-2">
                <textarea
                  rows="1"
                  value={setupPrompt}
                  onChange={(event) => setSetupPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submitSetupPrompt()
                    }
                  }}
                  className="input-field min-h-10 max-h-40 resize-y"
                  placeholder="Ecrivez votre besoin de formation..."
                />
                <button
                  type="button"
                  onClick={submitSetupPrompt}
                  disabled={isGenerating || !setupPrompt.trim()}
                  className="btn-primary h-10 w-10 inline-flex items-center justify-center p-0 disabled:opacity-50"
                  aria-label="Generer le scénario"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Nombre d'étapes: {desiredSteps}</label>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    step="1"
                    value={desiredSteps}
                    onChange={(event) => setDesiredSteps(Number(event.target.value))}
                    className="w-full accent-red-600"
                  />
                </div>
              </div>
              </div>
            ) : (
              <div className="mt-4 flex-1 overflow-auto">
                {scenarioLibraryLoading && (
                  <div className="text-sm text-black/60 text-center py-8">Chargement en cours...</div>
                )}

                {!scenarioLibraryLoading && scenarioLibraryError && (
                  <div className="border border-red-200 bg-red-50 text-red-700 text-sm p-3">{scenarioLibraryError}</div>
                )}

                {!scenarioLibraryLoading && !scenarioLibraryError && filteredScenarioRows.length === 0 && (
                  <div className="text-sm text-black/60 text-center py-8">
                    Aucun scenario disponible pour le moment.
                  </div>
                )}

                {!scenarioLibraryLoading && !scenarioLibraryError && filteredScenarioRows.length > 0 && (
                  <table className="min-w-full text-sm bg-white border border-black/10">
                    <thead className="sticky top-0 bg-[#f7f7f7] border-b border-black/10">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-black/70">
                          <div className="relative inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFilterMenu('id')}
                              className="inline-flex items-center gap-1 text-black/70 hover:text-black"
                            >
                              <span>ID</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${openFilterColumn === 'id' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilterColumn === 'id' && (
                              <div className="absolute left-0 top-full mt-2 w-56 rounded-lg border border-black/10 bg-white shadow-lg p-3 z-10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-black/50">Filtrer</span>
                                  <button type="button" onClick={() => clearColumnFilter('id')} className="text-black/50 hover:text-black">
                                    Tout
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={columnSearch.id}
                                  onChange={(event) => updateColumnSearch('id', event.target.value)}
                                  className="input-field h-8 mt-2 text-sm"
                                  placeholder="Rechercher..."
                                />
                                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                                  {getFilteredOptions('id', columnFilterOptions.id).length === 0 ? (
                                    <p className="text-xs text-black/50">Aucune valeur</p>
                                  ) : (
                                    getFilteredOptions('id', columnFilterOptions.id).map((option) => (
                                      <label key={`filter-id-${option}`} className="flex items-center gap-2 text-xs text-black/70">
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected('id', option, columnFilterOptions.id)}
                                          onChange={() => toggleFilterOption('id', option, columnFilterOptions.id)}
                                          className="h-3 w-3"
                                        />
                                        <span className="truncate">{option}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">Titre</th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">
                          <div className="relative inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFilterMenu('title')}
                              className="inline-flex items-center gap-1 text-black/70 hover:text-black"
                            >
                              <span>Documents</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${openFilterColumn === 'title' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilterColumn === 'title' && (
                              <div className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-black/10 bg-white shadow-lg p-3 z-10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-black/50">Filtrer</span>
                                  <button type="button" onClick={() => clearColumnFilter('title')} className="text-black/50 hover:text-black">
                                    Tout
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={columnSearch.title}
                                  onChange={(event) => updateColumnSearch('title', event.target.value)}
                                  className="input-field h-8 mt-2 text-sm"
                                  placeholder="Rechercher..."
                                />
                                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                                  {getFilteredOptions('title', columnFilterOptions.title).length === 0 ? (
                                    <p className="text-xs text-black/50">Aucune valeur</p>
                                  ) : (
                                    getFilteredOptions('title', columnFilterOptions.title).map((option) => (
                                      <label key={`filter-title-${option}`} className="flex items-center gap-2 text-xs text-black/70">
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected('title', option, columnFilterOptions.title)}
                                          onChange={() => toggleFilterOption('title', option, columnFilterOptions.title)}
                                          className="h-3 w-3"
                                        />
                                        <span className="truncate">{option}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">
                          <div className="relative inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFilterMenu('date')}
                              className="inline-flex items-center gap-1 text-black/70 hover:text-black"
                            >
                              <span>Date</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${openFilterColumn === 'date' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilterColumn === 'date' && (
                              <div className="absolute left-0 top-full mt-2 w-48 rounded-lg border border-black/10 bg-white shadow-lg p-3 z-10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-black/50">Filtrer</span>
                                  <button type="button" onClick={() => clearColumnFilter('date')} className="text-black/50 hover:text-black">
                                    Tout
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={columnSearch.date}
                                  onChange={(event) => updateColumnSearch('date', event.target.value)}
                                  className="input-field h-8 mt-2 text-sm"
                                  placeholder="Rechercher..."
                                />
                                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                                  {getFilteredOptions('date', columnFilterOptions.date).length === 0 ? (
                                    <p className="text-xs text-black/50">Aucune valeur</p>
                                  ) : (
                                    getFilteredOptions('date', columnFilterOptions.date).map((option) => (
                                      <label key={`filter-date-${option}`} className="flex items-center gap-2 text-xs text-black/70">
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected('date', option, columnFilterOptions.date)}
                                          onChange={() => toggleFilterOption('date', option, columnFilterOptions.date)}
                                          className="h-3 w-3"
                                        />
                                        <span className="truncate">{option}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">
                          <div className="relative inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFilterMenu('procedure')}
                              className="inline-flex items-center gap-1 text-black/70 hover:text-black"
                            >
                              <span>Procedure</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${openFilterColumn === 'procedure' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilterColumn === 'procedure' && (
                              <div className="absolute left-0 top-full mt-2 w-72 rounded-lg border border-black/10 bg-white shadow-lg p-3 z-10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-black/50">Filtrer</span>
                                  <button type="button" onClick={() => clearColumnFilter('procedure')} className="text-black/50 hover:text-black">
                                    Tout
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={columnSearch.procedure}
                                  onChange={(event) => updateColumnSearch('procedure', event.target.value)}
                                  className="input-field h-8 mt-2 text-sm"
                                  placeholder="Rechercher..."
                                />
                                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                                  {getFilteredOptions('procedure', columnFilterOptions.procedure).length === 0 ? (
                                    <p className="text-xs text-black/50">Aucune valeur</p>
                                  ) : (
                                    getFilteredOptions('procedure', columnFilterOptions.procedure).map((option, idx) => (
                                      <label key={`filter-procedure-${idx}`} className="flex items-center gap-2 text-xs text-black/70">
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected('procedure', option, columnFilterOptions.procedure)}
                                          onChange={() => toggleFilterOption('procedure', option, columnFilterOptions.procedure)}
                                          className="h-3 w-3"
                                        />
                                        <span className="truncate">{option}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">
                          <div className="relative inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFilterMenu('duration')}
                              className="inline-flex items-center gap-1 text-black/70 hover:text-black"
                            >
                              <span>Duree</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ${openFilterColumn === 'duration' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilterColumn === 'duration' && (
                              <div className="absolute left-0 top-full mt-2 w-40 rounded-lg border border-black/10 bg-white shadow-lg p-3 z-10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-black/50">Filtrer</span>
                                  <button type="button" onClick={() => clearColumnFilter('duration')} className="text-black/50 hover:text-black">
                                    Tout
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={columnSearch.duration}
                                  onChange={(event) => updateColumnSearch('duration', event.target.value)}
                                  className="input-field h-8 mt-2 text-sm"
                                  placeholder="Rechercher..."
                                />
                                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                                  {getFilteredOptions('duration', columnFilterOptions.duration).length === 0 ? (
                                    <p className="text-xs text-black/50">Aucune valeur</p>
                                  ) : (
                                    getFilteredOptions('duration', columnFilterOptions.duration).map((option) => (
                                      <label key={`filter-duration-${option}`} className="flex items-center gap-2 text-xs text-black/70">
                                        <input
                                          type="checkbox"
                                          checked={isOptionSelected('duration', option, columnFilterOptions.duration)}
                                          onChange={() => toggleFilterOption('duration', option, columnFilterOptions.duration)}
                                          className="h-3 w-3"
                                        />
                                        <span className="truncate">{option}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-black/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScenarioRows.map((row) => {
                        return (
                          <tr key={row.id} className="border-t border-black/10">
                            <td className="px-3 py-2 text-black/70">{row.id}</td>
                            <td className="px-3 py-2 text-black/80">{row.title}</td>
                            <td className="px-3 py-2 text-black/60 max-w-[220px] truncate" title={row.documents}>
                              {row.documents}
                            </td>
                            <td className="px-3 py-2 text-black/60">{row.date}</td>
                            <td className="px-3 py-2 text-black/60">{row.procedure}</td>
                            <td className="px-3 py-2 text-black/60">{row.duration}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUseLibraryScenario(row.item)}
                                  className="btn-secondary"
                                >
                                  Utiliser
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLibraryScenario(row.item)}
                                  className="btn-icon text-red-600 hover:bg-red-50 hover:text-red-700"
                                  title="Supprimer le scenario"
                                  aria-label={`Supprimer ${row.title}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {workflowStage === 'validation' && (
        <div className="mt-6 h-[calc(100vh-180px)] overflow-hidden">
          <section className="panel-surface h-full min-h-0 overflow-y-auto p-6 lg:p-7">
            <div className="grid min-h-full grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-black/10 pb-3">
                  <h3 className="text-lg font-display inline-flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-red-600" />
                    Etapes
                  </h3>
                  <span className="text-sm text-black/60">Edition detaillee</span>
                </div>

                {!scenarioDraft ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-black/60">
                    Generez un scénario depuis l étape de parametrage.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="form-label">Titre</label>
                        <input
                          type="text"
                          value={scenarioDraft.titre}
                          onChange={(event) => updateScenarioField('titre', event.target.value)}
                          className="input-field"
                        />
                      </div>

                      <div>
                        <label className="form-label">Difficulte</label>
                        <select
                          value={scenarioDraft.difficulte}
                          onChange={(event) => updateScenarioField('difficulte', event.target.value)}
                          className="input-field"
                        >
                          <option value="debutant">Debutant</option>
                          <option value="intermediaire">Intermediaire</option>
                          <option value="avance">Avance</option>
                          <option value="expert">Expert</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Duree totale (min)</label>
                        <input
                          type="number"
                          min="1"
                          value={scenarioDraft.duree_totale}
                          onChange={(event) => updateScenarioField('duree_totale', clampDuration(event.target.value))}
                          className="input-field"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="form-label">Description</label>
                        <textarea
                          value={scenarioDraft.description}
                          onChange={(event) => updateScenarioField('description', event.target.value)}
                          className="input-field min-h-[90px]"
                        />
                      </div>
                    </div>

                    <div className="mt-5 border-t border-black/10 pt-4 pr-1">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-display">Etapes a valider</h4>
                        <button
                          type="button"
                          onClick={addScenarioStep}
                          className="btn-secondary inline-flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Ajouter une étape
                        </button>
                      </div>

                      <div className="space-y-3">
                        {scenarioDraft.etapes.map((step, index) => (
                          <div key={step.id} className="border border-black/15 p-3 bg-white">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">étape {index + 1}</p>
                              <button
                                type="button"
                                onClick={() => removeScenarioStep(step.id)}
                                disabled={scenarioDraft.etapes.length <= 1}
                                className="text-red-600 disabled:opacity-35"
                                title="Supprimer cette étape"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="form-label">Intitule</label>
                                <input
                                  type="text"
                                  value={step.label}
                                  onChange={(event) => updateScenarioStep(step.id, 'label', event.target.value)}
                                  className="input-field"
                                />
                              </div>

                              <div>
                                <label className="form-label">Duree (min)</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={step.duration}
                                  onChange={(event) => updateScenarioStep(step.id, 'duration', event.target.value)}
                                  className="input-field"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="form-label">Instruction</label>
                                <textarea
                                  value={step.description}
                                  onChange={(event) => updateScenarioStep(step.id, 'description', event.target.value)}
                                  className="input-field min-h-[80px]"
                                />
                              </div>

                              <div className="col-span-2 border border-black/10 p-3 bg-black/[0.02]">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="form-label mb-0">Elements & Actions</label>
                                  <button
                                    type="button"
                                    onClick={() => addScenarioStepObjectTarget(step.id)}
                                    disabled={componentOptions.length === 0}
                                    className="btn-secondary inline-flex items-center gap-2"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Ajouter un objet
                                  </button>
                                </div>

                                <div className="space-y-2 mt-2">
                                  {componentOptions.length === 0 && (
                                    <div className="border border-dashed border-black/20 rounded p-3 text-sm text-black/55 bg-white">
                                      Aucun composant 3D valide.
                                    </div>
                                  )}
                                  {componentOptions.length > 0 && (step.objectTargets || []).map((target, targetIndex) => (
                                    <div key={target.id || `${step.id}-${targetIndex}`} className="grid grid-cols-[1fr_180px_auto] gap-2">
                                      <select
                                        value={target.component3dId}
                                        onChange={(event) =>
                                          updateScenarioStepObjectTarget(step.id, targetIndex, 'component3dId', event.target.value)
                                        }
                                        className="input-field"
                                      >
                                        {componentOptions.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>

                                      <select
                                        value={target.action}
                                        onChange={(event) =>
                                          updateScenarioStepObjectTarget(step.id, targetIndex, 'action', event.target.value)
                                        }
                                        className="input-field"
                                      >
                                        {STEP_OBJECT_ACTION_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        onClick={() => removeScenarioStepObjectTarget(step.id, targetIndex)}
                                        disabled={(step.objectTargets || []).length <= 1}
                                        className="btn-secondary px-3 disabled:opacity-35"
                                        title="Supprimer cet objet"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col min-h-0">
                <h3 className="text-lg font-display inline-flex items-center gap-2 border-b border-black/10 pb-3">
                  <ListChecks className="h-5 w-5 text-red-600" />
                  Configuration initiale
                </h3>

                <div className="mt-4 flex-1 min-h-0 overflow-hidden rounded border border-black/15 bg-white p-4 space-y-5 text-sm">
                  <div className="pt-2 border-t border-black/10">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-black/70">Composants 3D validés</h5>
                      <span className="text-xs text-black/45">Documents</span>
                    </div>
                    <div className="space-y-3">
                      {equipmentOptions.length === 0 && (
                        <div className="border border-dashed border-black/20 rounded p-3 text-sm text-black/55 bg-white">
                          Aucun composant 3D valide.
                        </div>
                      )}
                      {equipmentOptions.map((equipment) => (
                        <div key={equipment.value} className="border border-black/10 rounded p-3 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <label className="form-label">{equipment.label}</label>
                            <span className="text-xs text-black/45">
                              {equipment.states.length} état(s)
                            </span>
                          </div>
                          <select
                            value={
                              scenarioDraft?.parametres_techniques?.etats_base_equipements?.[equipment.value]
                              || equipment.states[0]
                              || ''
                            }
                            onChange={(event) => updateTechnicalEquipmentState(equipment.value, event.target.value)}
                            disabled={equipment.states.length === 0}
                            className="input-field mt-2"
                          >
                            {equipment.states.length === 0 && (
                              <option value="">Aucun état défini</option>
                            )}
                            {equipment.states.map((state) => (
                              <option key={`${equipment.value}-${state}`} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-black/10 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkflowStage('setup')}
                      className="btn-secondary"
                    >
                      Revenir au parametrage
                    </button>
                    <button
                      type="button"
                      onClick={validateScenario}
                      disabled={isValidating || !scenarioDraft}
                      className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isValidating ? 'Validation...' : 'Valider le scénario'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {workflowStage === 'dashboard' && (
        <div className="mt-6 flex flex-col gap-3 h-[72vh] overflow-hidden">
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
            <aside className="col-span-3 panel-surface p-4 flex flex-col gap-4 overflow-hidden">
              <section className="space-y-3 flex-1 flex flex-col min-h-0">
                <h3 className="text-base font-display mb-2">Affectation apprenant</h3>
                <div className="rounded border border-black/10 bg-white p-3 space-y-3">
                  <div>
                    <label className="form-label">Choisir un apprenant</label>
                    <select
                      value={selectedLearnerId}
                      onChange={(event) => setSelectedLearnerId(event.target.value)}
                      className="input-field mt-1"
                      disabled={learners.length === 0}
                    >
                      <option value="">{learners.length === 0 ? 'Aucun apprenant disponible' : 'Sélectionner un apprenant'}</option>
                      {learners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.prenom} {learner.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-primary w-full inline-flex items-center justify-center gap-2"
                    onClick={assignScenarioToLearner}
                    disabled={!scenarioDraft || !selectedLearner}
                  >
                    <Send className="h-4 w-4" />
                    Associer et notifier
                  </button>
                </div>

                <h3 className="text-base font-display mb-2 pt-2 border-t border-black/10">Timeline d'activité</h3>
                <div className="flex-1 overflow-y-auto min-h-0 border border-black/10 rounded bg-white p-2">
                  {timeline.length === 0 ? (
                    <div className="text-sm text-black/50 text-center py-8">Aucune activité pour le moment.</div>
                  ) : (
                    <ul className="space-y-2">
                      {timeline.map((step, idx) => (
                        <li key={step.id} className="border-b border-black/10 pb-2 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-black/40">{idx + 1}.</span>
                            <span className="font-medium text-black/80">{step.label}</span>
                            <span className="ml-auto text-xs text-black/50">{step.duration} min</span>
                          </div>
                          {step.description && (
                            <div className="text-xs text-black/60 mt-1">{step.description}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </aside>

            <section className="col-span-9 panel-surface p-4 min-h-0 overflow-hidden flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
                <div>
                  <h3 className="text-lg font-display inline-flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-red-600" />
                    Sessions de formation
                  </h3>
                  <p className="text-sm text-black/55 mt-1">
                    Vue compacte des sessions à lancer et de celles déjà engagées.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 flex-1">
                <div className="rounded-2xl border border-[#e63641]/35 bg-[#e63641]/6 p-4 flex flex-col min-h-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="mt-3 text-base font-display">Sessions en attente de réalisation</h4>
                      <p className="text-sm text-black/55 mt-1">Apprenants à qui le scénario doit encore être attribué.</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.12em] text-black/45">{pendingLearnerSessions.length}</span>
                  </div>

                  <div className="mt-4 space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
                    {pendingLearnerSessions.length === 0 ? (
                      <div className="rounded border border-black/10 bg-white p-3 text-sm text-black/50">
                        Aucune session en attente.
                      </div>
                    ) : (
                      pendingLearnerSessions.map((learner) => renderLearnerSessionCard(learner))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e63641]/35 bg-[#e63641]/6 p-4 flex flex-col min-h-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="mt-3 text-base font-display">Sessions en cours ou terminées</h4>
                      <p className="text-sm text-black/55 mt-1">Scénarios déjà associés, visibles dans le tableau de bord des apprenants.</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.12em] text-black/45">{activeLearnerSessions.length}</span>
                  </div>

                  <div className="mt-4 space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
                    {activeLearnerSessions.length === 0 ? (
                      <div className="rounded border border-black/10 bg-white p-3 text-sm text-black/50">
                        Aucune session active.
                      </div>
                    ) : (
                      activeLearnerSessions.map((learner) => renderLearnerSessionCard(learner))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {isQrModalOpen && (
            <Modal onClose={() => setIsQrModalOpen(false)}>
              <div
                className="flex flex-col items-center justify-center p-4 w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto modal-qr-code"
                style={{ minWidth: 0, width: '100%', height: 'fit-content', maxHeight: '80vh' }}
              >
                <h3 className="text-lg font-display mb-4 flex items-center gap-2 text-center">
                  <Headset className="h-5 w-5 text-red-600" />
                  Details d'acces
                </h3>

                {assignedAccess?.config_url && (
                  <div className="rounded border border-black/10 bg-white p-4">
                    <QrCodeLoader value={assignedAccess.config_url} size={180} />
                  </div>
                )}

                <div className="mt-6 w-full space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span>Scenario : <b>{currentScenarioTitle}</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 bg-black/20 rounded-full" />
                    <span>Apprenant associe : <b>{assignedAccess?.learnerName || `${selectedLearner?.prenom || ''} ${selectedLearner?.nom || ''}`}</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span>Le scenario est maintenant visible dans l'espace apprenant.</span>
                  </div>
                  <div className="rounded border border-black/10 bg-white p-2 text-xs break-all">
                    {assignedAccess?.config_url || qrCodeUrl}
                  </div>
                  {assignedAccess?.session_id && (
                    <div className="rounded border border-black/10 bg-white p-2 text-xs break-all">
                      session_id: {assignedAccess.session_id}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-primary mt-6 w-full"
                  onClick={() => setIsQrModalOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {isToastVisible && toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-[100] max-w-xs rounded-lg border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-xs flex items-center gap-2 shadow-lg transition-opacity duration-300 ${
            isToastFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}

export default MainPage
