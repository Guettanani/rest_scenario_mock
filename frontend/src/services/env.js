export const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const QR_CONFIG_URL = import.meta.env.VITE_QR_CONFIG_URL || '/api/v1/config'

export const DISCOVERY_URL = import.meta.env.VITE_DISCOVERY_URL || '/api/v1/health/discovery'

export function resolveApiUrl(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_URL}${cleanPath}`
}
