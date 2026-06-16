import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Gauge,
  Pause,
  RefreshCw,
  Send,
  Settings2,
  Users,
  Zap,
  Radio,
} from 'lucide-react'
import monitoringService from '../services/monitoringService'
import '../styles/monitoring.css'

function LiveMonitoring() {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionDetails, setSessionDetails] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('idle')
  const [voiceInput, setVoiceInput] = useState('')
  const [notice, setNotice] = useState('')

  // Récupère la liste des sessions actives
  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await monitoringService.fetchActiveSessions()
      setSessions(data.sessions || [])
    } catch (err) {
      setError(`Erreur lors de la récupération des sessions: ${err.message}`)
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Établit la connexion WebSocket à une session
  const connectToSession = useCallback((sessionId) => {
    setSelectedSession(sessionId)
    setConnectionStatus('connecting')

    monitoringService.connectToSession(
      sessionId,
      // onMessage handler
      (message) => {
        if (message.type === 'monitor_connected') {
          setSessionDetails(message.state)
          setConnectionStatus('connected')
        } else if (message.type === 'session_update') {
          // Mise à jour en temps réel
          setSessionDetails((prev) => {
            if (!prev) return null
            const updated = { ...prev }
            if (message.event === 'state_changed') {
              updated.elements = { ...updated.elements, ...message.data.elements }
            } else if (message.event === 'scenario_started') {
              updated.scenario_progress = message.data
            } else if (message.event === 'step_completed') {
              if (updated.scenario_progress) {
                updated.scenario_progress.current_step = message.data.current_step
                updated.scenario_progress.score = message.data.score
                updated.scenario_progress.completed_steps = message.data.completed_steps
              }
            } else if (message.event === 'scenario_reset') {
              updated.scenario_progress = null
              updated.elements = message.data.elements || {}
            }
            return updated
          })
        } else if (message.type === 'command_response') {
          setNotice(`Commande exécutée: ${message.command}`)
        }
      },
      // onConnect handler
      (evt) => {
        if (evt.type === 'connected') {
          setConnectionStatus('connected')
        } else {
          setConnectionStatus('disconnected')
        }
      },
      // onError handler
      (err) => {
        setError(`Erreur de connexion: ${err}`)
        setConnectionStatus('error')
      },
    )
  }, [])

  // Déconnecte du WebSocket
  const disconnectSession = useCallback(() => {
    monitoringService.disconnect()
    setSelectedSession(null)
    setSessionDetails(null)
    setConnectionStatus('idle')
  }, [])

  const sendVoiceMessage = useCallback(() => {
    if (!voiceInput.trim()) return
    monitoringService.sendVoiceMessage(voiceInput)
    setVoiceInput('')
    setNotice('Message vocal envoyé')
  }, [voiceInput])

  // Polling initial et auto-refresh toutes les 5 secondes
  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      monitoringService.disconnect()
    }
  }, [])

  return (
    <div className="monitoring-shell">
      {notice && (
        <div className="monitoring-success-banner">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      <div className="monitoring-layout">
        {/* Panel de liste des sessions */}
        <section className="monitoring-sessions-panel">
          <header className="monitoring-section-header">
            <div>
              <h2>Sessions VR Actives</h2>
              <p>Sessions connectées au serveur</p>
            </div>
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              className="monitoring-refresh-btn"
              title="Rafraîchir la liste"
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            </button>
          </header>

          {error && (
            <div className="monitoring-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="monitoring-sessions-list">
            {sessions.length === 0 ? (
              <div className="monitoring-empty">
                <Users size={32} />
                <p>Aucune session active pour le moment</p>
                <small>Les sessions VR connectées apparaîtront ici</small>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.session_id}
                  type="button"
                  className={`monitoring-session-card ${
                    selectedSession === session.session_id ? 'selected' : ''
                  }`}
                  onClick={() => connectToSession(session.session_id)}
                >
                  <div className="session-card-header">
                    <Activity size={16} className="session-active-indicator" />
                    <code className="session-id-badge">{session.session_id.slice(0, 8)}</code>
                  </div>

                  <div className="session-card-stats">
                    <span>
                      <Settings2 size={12} />
                      {session.element_count} éléments
                    </span>
                    {session.scenario ? (
                      <span className="scenario-active">
                        <Zap size={12} />
                        Scénario actif
                      </span>
                    ) : (
                      <span>Pas de scénario</span>
                    )}
                  </div>

                  {session.scenario && (
                    <div className="session-scenario-preview">
                      <p>{session.scenario.scenario_title}</p>
                      <small>
                        Étape {session.scenario.current_step}/{session.scenario.total_steps}
                      </small>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Panel de détails et contrôle */}
        <section className="monitoring-detail-panel">
          {selectedSession && sessionDetails ? (
            <>
              <header className="monitoring-section-header">
                <div>
                  <h2>Détails Session</h2>
                  <code>{selectedSession}</code>
                </div>
                <div className={`monitoring-status-badge ${
                  connectionStatus === 'connected' ? 'bg-green-100' :
                  connectionStatus === 'connecting' ? 'bg-blue-100' :
                  connectionStatus === 'error' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <Radio size={12} />
                  {connectionStatus === 'connected' && 'Connecté'}
                  {connectionStatus === 'connecting' && 'Connexion...'}
                  {connectionStatus === 'error' && 'Erreur'}
                  {connectionStatus === 'disconnected' && 'Déconnecté'}
                </div>
              </header>

              {/* État des éléments VR */}
              <div className="monitoring-elements-section">
                <h3>État des Éléments</h3>
                <div className="elements-grid">
                  {Object.entries(sessionDetails.elements || {}).map(([elementName, props]) => (
                    <div key={elementName} className="element-card">
                      <h4>{elementName}</h4>
                      <div className="element-properties">
                        {Object.entries(props || {}).map(([propName, propValue]) => (
                          <div key={propName} className="property-row">
                            <span className="property-name">{propName}</span>
                            <span className="property-value">{String(propValue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progression du scénario */}
              {sessionDetails.scenario_progress ? (
                <div className="monitoring-scenario-section">
                  <h3>
                    <Gauge size={16} />
                    Progression Scénario
                  </h3>
                  <div className="scenario-info">
                    <h4>{sessionDetails.scenario_progress.scenario_title}</h4>
                    <div className="scenario-metrics">
                      <div className="metric">
                        <label>Étape actuelle</label>
                        <strong>{sessionDetails.scenario_progress.current_step}</strong>
                      </div>
                      <div className="metric">
                        <label>Total</label>
                        <strong>{sessionDetails.scenario_progress.total_steps}</strong>
                      </div>
                      <div className="metric">
                        <label>Score</label>
                        <strong>{sessionDetails.scenario_progress.score}</strong>
                      </div>
                      <div className="metric">
                        <label>Temps écoulé</label>
                        <strong>{Math.round(sessionDetails.scenario_progress.elapsed_seconds || 0)}s</strong>
                      </div>
                    </div>

                    <div className="progress-bar-container">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(sessionDetails.scenario_progress.current_step / sessionDetails.scenario_progress.total_steps) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="progress-text">
                        {Math.round(
                          (sessionDetails.scenario_progress.current_step /
                            sessionDetails.scenario_progress.total_steps) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="monitoring-no-scenario">
                  <Clock size={24} />
                  <p>Aucun scénario en cours</p>
                  <small>Le suivi apparaîtra lorsqu'une session VR lancera un scénario réel</small>
                </div>
              )}

              {/* Injection de message vocal */}
              <div className="monitoring-voice-section">
                <h3>Injection Dialogue Vocal</h3>
                <div className="voice-input-group">
                  <input
                    type="text"
                    placeholder="Message à injecter dans le dialogue VR..."
                    value={voiceInput}
                    onChange={(e) => setVoiceInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        sendVoiceMessage()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendVoiceMessage}
                    className="send-voice-btn"
                    disabled={!voiceInput.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={disconnectSession}
                className="monitoring-disconnect-btn"
              >
                <Pause size={16} />
                Arrêter le Suivi
              </button>
            </>
          ) : (
            <div className="monitoring-placeholder">
              <Settings2 size={32} />
              <h3>Sélectionnez une session</h3>
              <p>Cliquez sur une session pour commencer le suivi en direct</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default LiveMonitoring
