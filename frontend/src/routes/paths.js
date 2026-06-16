export const APP_ROUTES = {
  home: '/home',
  root: '/',
  dashboard: '/dashboard',
  apprenant: '/apprenant',
  documents: '/documents',
  login: '/login',
  register: '/register',
  profile: '/profile',
  admin: '/admin',
  adminScenario: '/admin/scenario',
  scenarioLibrary: '/scenario-library',
  tokenMonitoring: '/token-monitoring',
}

export const PRIVATE_ROUTE_SEGMENTS = {
  dashboard: 'dashboard',
  apprenant: 'apprenant',
  documents: 'documents',
  profile: 'profile',
  admin: 'admin',
  adminScenario: 'admin/scenario',
  scenarioLibrary: 'scenario-library',
  tokenMonitoring: 'token-monitoring',
}

export function isAuthPagePath(pathname) {
  return pathname === APP_ROUTES.login || pathname === APP_ROUTES.register
}