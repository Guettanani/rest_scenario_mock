import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import KeepAliveOutlet from './KeepAliveOutlet'
import LeftSidebar from './LeftSidebar'
import { APP_ROUTES } from '../routes/paths'

function Layout() {
  const { logout, isAdmin, isApprenant } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const handleLogout = () => {
    logout()
    navigate(APP_ROUTES.login)
  }

  const isAdminUser = isAdmin()
  const isLearnerUser = isApprenant()
  const sidebarTools = isLearnerUser
    ? [
        { img: '/img/sidebar-generation.png', label: 'Mes\nformations', to: APP_ROUTES.apprenant },
        { img: '/img/sidebar-compte.png', label: 'Compte', to: APP_ROUTES.profile },
      ]
    : [
        { img: '/img/sidebar-generation.png', label: 'Paramétrer\nun scénario', to: APP_ROUTES.dashboard },
        { img: '/img/sidebar-upload.png', label: 'Documents\nformation', to: APP_ROUTES.documents },
        ...(isAdminUser
          ? [{ img: '/img/sidebar-utilisateurs.png', label: 'Gestion des\nutilisateurs', to: APP_ROUTES.admin }]
          : []),
        { img: '/img/sidebar-compte.png', label: 'Compte', to: APP_ROUTES.profile },
      ]

  const handleToggleSidebar = () => {
    setIsSidebarOpen((previous) => !previous)
  }

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return (
      <div className="desktop-only-message tech-grid-background">
        <div className="panel-surface max-w-md p-8">
          <h1 className="text-2xl font-semibold">Scenia version desktop</h1>
          <p className="mt-3 text-sm section-caption">
            Cette interface est optimisee pour un ecran desktop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#e8e8e8]">
      <LeftSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        onNavigate={navigate}
        onHomeClick={() => navigate(APP_ROUTES.home)}
        tools={sidebarTools}
        activePath={location.pathname}
        ctaLabel="Deconnexion"
        onCta={handleLogout}
      />

      <main className="flex-1 overflow-y-auto bg-[#f2f2f2]">
        <div className="p-6">
          <KeepAliveOutlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
