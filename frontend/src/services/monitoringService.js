// Service de monitoring pour les sessions VR en temps réel

import { API_URL } from './env'
class MonitoringService {
  constructor() {
    this.ws = null
    this.sessionId = null
    this.messageHandlers = []
    this.connectionHandlers = []
    this.errorHandlers = []
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 2000
  }

  /**
   * Récupère la liste des sessions actives avec détails complets
   */
  async fetchActiveSessions() {
    try {
      const response = await fetch(`${API_URL}/state/sessions/active/detailed`)
      if (!response.ok) {
        return { sessions: [] }
      }
      return await response.json()
    } catch (error) {
      console.debug('Monitoring sessions non disponible:', error?.message || error)
      return { sessions: [] }
    }
  }

  /**
   * Se connecte au WebSocket de monitoring pour une session
   */
  connectToSession(sessionId, onMessage, onConnect, onError) {
    this.sessionId = sessionId
    this.messageHandlers = Array.isArray(onMessage) ? onMessage : [onMessage].filter(Boolean)
    this.connectionHandlers = [onConnect].filter(Boolean)
    this.errorHandlers = [onError].filter(Boolean)

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/state/monitor/${sessionId}`

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log(`[Monitor] Connected to session ${sessionId}`)
      this.reconnectAttempts = 0
      this.connectionHandlers.forEach((handler) => handler({ type: 'connected', sessionId }))
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.messageHandlers.forEach((handler) => handler(data))
      } catch (error) {
        console.error('[Monitor] Failed to parse message:', error, event.data)
      }
    }

    this.ws.onerror = (error) => {
      console.error(`[Monitor] WebSocket error for session ${sessionId}:`, error)
      this.errorHandlers.forEach((handler) => handler(error))
    }

    this.ws.onclose = () => {
      console.log(`[Monitor] Disconnected from session ${sessionId}`)
      this.connectionHandlers.forEach((handler) => handler({ type: 'disconnected', sessionId }))
      this.attemptReconnect()
    }
  }

  /**
   * Tente de se reconnecter automatiquement
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Monitor] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts += 1
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    console.log(`[Monitor] Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      const sessionId = this.sessionId
      const handlers = this.messageHandlers
      const connHandlers = this.connectionHandlers
      const errHandlers = this.errorHandlers
      this.disconnect()
      this.connectToSession(sessionId, handlers, connHandlers[0], errHandlers[0])
    }, delay)
  }

  /**
   * Envoie une commande admin à la session
   */
  sendCommand(command, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[Monitor] WebSocket not connected')
      return false
    }

    const payload = { command, ...data }
    this.ws.send(JSON.stringify(payload))
    return true
  }

  /**
   * Commandes spécifiques
   */
  startScenario(scenarioId, scenarioTitle, totalSteps) {
    return this.sendCommand('scenario_start', {
      scenario_id: scenarioId,
      scenario_title: scenarioTitle,
      total_steps: totalSteps,
    })
  }

  completeStep(step, scoreDelta = 0) {
    return this.sendCommand('scenario_step', {
      step,
      score_delta: scoreDelta,
    })
  }

  resetScenario() {
    return this.sendCommand('scenario_reset')
  }

  getState() {
    return this.sendCommand('get_state')
  }

  /**
   * Déconnecte le WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.messageHandlers = []
    this.connectionHandlers = []
    this.errorHandlers = []
    this.sessionId = null
  }

  /**
   * Envoie une injection de message vocal (pour dialogue VR)
   */
  sendVoiceMessage(text) {
    return this.sendCommand('voice_message', {
      message: text,
    })
  }

  /**
   * Vérifie si la connexion est active
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }
}

// Export singleton
export const monitoringService = new MonitoringService()
export default monitoringService
