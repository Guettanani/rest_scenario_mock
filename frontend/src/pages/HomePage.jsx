import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../routes/paths'
import { Menu } from 'lucide-react'
import LeftSidebar from '../components/LeftSidebar'

const SIDEBAR_TOOLS = [
  { img: '/img/sidebar-generation.png', label: 'Paramétrer\nun scénario', to: APP_ROUTES.login },
  { img: '/img/sidebar-upload.png', label: 'Documents\nformation', to: APP_ROUTES.login },
  { img: '/img/sidebar-utilisateurs.png', label: 'Gestion des\nutilisateurs', to: APP_ROUTES.login },
  { img: '/img/sidebar-compte.png', label: 'Compte', to: APP_ROUTES.login },
]

const FEATURES = [
  { img: '/img/feat-4.png', label: 'Interprétation de documents' },
  { img: '/img/feat-3.png', label: 'Génération de scénarios personnalisés' },
  { img: '/img/feat-2.png', label: 'Agent conversationnel en direct' },
  { img: '/img/feat-1.png', label: 'Analyse des résultats' },
]

const WHY_ITEMS = [
  { img: '/img/why-automatiser.png', label: 'Automatiser les\nprocessus' },
  { img: '/img/why-millions.png', label: 'Des millions de\nsituations possibles' },
  { img: '/img/why-adaptes.png', label: 'Scénarios adaptés à\nchaque apprenant' },
  { img: '/img/why-partout.png', label: 'Utilisable partout' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const handleToggleSidebar = () => {
    setIsSidebarOpen((previous) => !previous)
  }

  return (
    <div className="min-h-screen flex bg-[#e8e8e8]">
      <LeftSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        onNavigate={navigate}
        onHomeClick={() => navigate(APP_ROUTES.home)}
        tools={SIDEBAR_TOOLS}
        activePath={location.pathname}
        ctaLabel="Connexion / Inscription"
        onCta={() => navigate(APP_ROUTES.login)}
      />

      {/* ━━ MAIN CONTENT ━━ */}
      <main className="flex-1 overflow-y-auto bg-[#f2f2f2]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-5 py-3 bg-[#e8e8e8] border-b border-gray-300">
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 text-gray-700" />
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.home)}
              className="font-display font-bold text-sm text-gray-900 hover:text-[#e63641] transition-colors"
            >
              Scen-IA
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.login)}
            className="text-[11px] font-semibold text-white bg-[#e63641] hover:bg-[#d12e39] px-3 py-1.5 rounded-md transition-colors"
          >
            Connexion / Inscription
          </button>
        </div>

        {/* ── HERO ── */}
        <section className="flex flex-col items-center pt-12 lg:pt-16 pb-10 px-6 text-center">
          <div className="select-none mb-6">
            <div
              className="font-display font-bold uppercase tracking-tight text-[#333]"
              style={{ fontSize: 'clamp(4rem, 10vw, 7rem)', lineHeight: '0.9' }}
            >
              SCEN
            </div>
            <div className="flex items-center justify-center -mt-1">
              <div
                className="rounded-full bg-[#4a4a4a] flex-shrink-0"
                style={{ width: 'clamp(3rem, 7vw, 5rem)', height: 'clamp(3rem, 7vw, 5rem)' }}
              />
              <div
                className="font-display font-bold uppercase tracking-tight text-[#e63641] -ml-1"
                style={{ fontSize: 'clamp(4rem, 10vw, 7rem)', lineHeight: '0.9' }}
              >
                IA
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-base md:text-lg mb-6">
            Générez les formations de demain
          </p>
          {/* Labels removed as requested */}
        </section>

        {/* ── C'EST QUOI SCEN-IA ? ── */}
        <section className="max-w-3xl mx-auto px-6 py-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            C'est Quoi Scen-IA?
          </h2>
          <p className="text-gray-500 text-xs md:text-sm leading-relaxed mb-10 max-w-2xl mx-auto">
            Scen-IA automatise la création de formations en réalité virtuelle à partir de vos documents
            techniques (Excel, Word). Grâce à une IA locale sécurisée, l'outil génère des scénarios
            interactifs pour VR au format JSON, tout en incluant un agent conversationnel vocal et
            un suivi en temps réel pour le formateur. Chaque session se conclut par un score de
            performance automatique et un bilan détaillé des points de vigilance.
          </p>
          <div className="grid grid-cols-2 gap-5 max-w-xl mx-auto">
            {FEATURES.map(({ img, label }) => (
              <div
                key={label}
                className="landing-card card-red min-h-[160px]"
              >
                <img src={img} alt="" className="w-14 h-14 object-contain brightness-0 invert" />
                <span className="font-semibold text-sm text-center leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMMENT ÇA MARCHE ? ── */}
        <section className="max-w-3xl mx-auto px-6 py-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-8">
            Comment Ça Marche?
          </h2>
          <div className="rounded-2xl bg-white border border-gray-200 p-4 md:p-6 shadow-sm">
            <img
              src="/img/architecture.png"
              alt="Architecture Scen-IA — PC → OCR → Embedding → LLM → State Sync → VR"
              className="w-full h-auto"
            />
          </div>
        </section>

        {/* ── POURQUOI UTILISER SCEN-IA ── */}
        <section className="max-w-3xl mx-auto px-6 py-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Pourquoi Utiliser Scen-IA
          </h2>
          <p className="text-gray-400 text-xs mb-8 max-w-md mx-auto">
            Des outils avancés pour améliorer votre méthodologie d&apos;apprentissage.
          </p>
          <div className="flex items-start justify-center gap-8 flex-wrap">
            {WHY_ITEMS.map(({ img, label }) => (
              <div key={label} className="flex flex-col items-center gap-3 w-28">
                <div className="w-20 h-20 rounded-full bg-[#e63641] flex items-center justify-center p-4">
                  <img src={img} alt="" className="w-full h-full object-contain brightness-0 invert" />
                </div>
                <span className="text-xs text-gray-600 text-center leading-snug whitespace-pre-line">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="max-w-3xl mx-auto px-6 py-10">
          <div className="relative rounded-2xl overflow-hidden flex flex-col justify-end min-h-[320px]">
            <img
              src="/img/photo-cta-vr.jpg"
              alt="Formation VR"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative p-8 md:p-10">
              <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
                Pas de questions?
              </h3>
              <Link
                to={APP_ROUTES.login}
                className="inline-block bg-[#e63641] hover:bg-[#d12e39] text-white text-sm font-semibold px-5 py-2 rounded-md transition-colors"
              >
                Commencer
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="max-w-3xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link
            to={APP_ROUTES.login}
            className="border-2 border-[#e63641] text-[#e63641] hover:bg-[#e63641] hover:text-white text-xs font-semibold px-5 py-2 rounded-md transition-colors"
          >
            Connexion / Inscription
          </Link>
          <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
            <span>hello@scen-ia.com</span>
            <span>Instagram</span>
            <span>X</span>
            <span>LinkedIn</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
