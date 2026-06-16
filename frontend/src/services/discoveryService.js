/**
 * Service de découverte automatique du serveur backend.
 * Utilisé pour la configuration dynamique en mode Tauri (application native).
 */

import { API_URL } from './env'

const DEFAULT_BACKENDS = [API_URL.replace(/\/api\/v1\/?$/, '')]

/**
 * Tente de découvrir le serveur backend.
 * Essaie d'abord les URLs par défaut, puis peut scanner le réseau local.
 */
export async function discoverServer(customUrls = []) {
  const urlsToTry = [...customUrls, ...DEFAULT_BACKENDS];
  
  for (const baseUrl of urlsToTry) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/health/discovery`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          name: data.name,
          version: data.version,
          ip: data.ip,
          port: data.port,
          apiUrl: `http://${data.ip}:${data.port}/api/v1`,
          wsStateSync: data.websockets?.state_sync || `ws://${data.ip}:${data.port}/api/v1/state/ws`,
          wsVoice: data.websockets?.voice_dialogue || `ws://${data.ip}:${data.port}/api/v1/voice/dialogue`,
        };
      }
    } catch (error) {
      // Ce serveur n'est pas accessible, essayer le suivant
      console.debug(`Server not found at ${baseUrl}`);
    }
  }
  
  return null;
}

/**
 * Vérifie si l'application s'exécute dans Tauri (mode natif).
 */
export function isTauriApp() {
  // Tauri/native packaging removed — always run as web app in this build.
  return false;
}

/**
 * Récupère l'URL de l'API selon le contexte.
 * - En mode web (Docker): utilise le proxy Vite (/api/v1)
 * - En mode Tauri: découvre le serveur automatiquement
 */
export async function getApiBaseUrl() {
  // Web-only flow: use configured API URL (Vite proxy or absolute URL).
  return API_URL
}

/**
 * Sauvegarde une configuration serveur personnalisée.
 */
export function setCustomServer(ip, port) {
  const apiUrl = `http://${ip}:${port}/api/v1`;
  localStorage.setItem('scenia_api_url', apiUrl);
  localStorage.setItem('scenia_server_ip', ip);
  localStorage.setItem('scenia_server_port', String(port));
}

/**
 * Récupère la configuration serveur sauvegardée.
 */
export function getSavedServerConfig() {
  const ip = localStorage.getItem('scenia_server_ip');
  const port = localStorage.getItem('scenia_server_port');
  
  if (ip && port) {
    return { ip, port: parseInt(port, 10) };
  }
  return null;
}

const discoveryService = {
  discoverServer,
  isTauriApp,
  getApiBaseUrl,
  setCustomServer,
  getSavedServerConfig,
}

export default discoveryService
