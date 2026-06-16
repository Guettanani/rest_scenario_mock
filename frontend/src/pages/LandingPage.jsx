import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../routes/paths'
import {
  FileText,
  Sparkles,
  MessageSquare,
  BarChart2,
  Cpu,
  Repeat,
  Users,
  MapPin,
} from 'lucide-react'

const FEATURES = [
  {
    icon: FileText,
    label: 'Interprétation de documents',
  },
  {
    icon: Sparkles,
    label: 'Génération de scénarios personnalisés',
  },
  {
    icon: MessageSquare,
    label: 'Agent conversationnel en direct',
  },
  {
    icon: BarChart2,
    label: 'Analyse des résultats',
  },
]

const WHY_ITEMS = [
  { icon: Cpu, label: 'Automatiser les processus' },
  { icon: Repeat, label: 'Des millions de situations possibles' },
  { icon: Users, label: 'Scénarios adaptés à chaque apprenant' },
  { icon: MapPin, label: 'Utilisable partout' },
]

const TECH_TAGS = [
  { label: 'React' },
  { label: 'Scen' },
  { label: 'VR' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-10 py-5 border-b border-gray-100">
        <span className="font-display text-xl font-bold text-gray-900 tracking-wide">
          Scen-IA
        </span>
        <Link
          to={APP_ROUTES.login}
          className="btn-primary px-5 py-2 text-sm"
        >
          Générer l'inscription
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center pt-16 pb-10 px-6 text-center">
        {/* Logo mark */}
        <div className="relative mb-6 select-none">
          <div
            className="font-display leading-none text-[clamp(5rem,14vw,9rem)] tracking-tight text-[#e63641] uppercase"
            style={{ lineHeight: '0.88' }}
          >
            SCEN
          </div>
          <div className="flex items-center gap-3">
            {/* Gray circle decoration */}
            <div className="w-[clamp(3.5rem,9vw,6rem)] h-[clamp(3.5rem,9vw,6rem)] rounded-full bg-gray-300 -mr-2" />
            <div
              className="font-display leading-none text-[clamp(5rem,14vw,9rem)] tracking-tight text-[#e63641] uppercase"
              style={{ lineHeight: '0.88' }}
            >
              IA
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-base md:text-lg mb-8 max-w-sm">
          Générez les formations de demain
        </p>

        {/* Tech tags */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {TECH_TAGS.map((tag, i) => (
            <span key={tag.label} className="flex items-center gap-2">
              {i > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />}
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full border border-gray-400 inline-block" />
                {tag.label}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ── C'est Quoi Scen-IA? ── */}
      <section className="max-w-3xl mx-auto px-6 py-14 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
          C'est Quoi Scen-IA?
        </h2>
        <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-10 max-w-2xl mx-auto">
          Scen-IA automatise la création de formations en réalité virtuelle à partir de vos documents
          techniques (Excel, Word). Grâce à une IA locale sécurisée, l'outil génère des scénarios
          interactifs pour VR au format JSON, tout en incluant un agent conversationnel vocal et
          un suivi en temps réel pour le formateur. Chaque session se conclut par un score de
          performance automatique et un bilan détaillé des points de vigilance.
        </p>

        {/* 2×2 feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="landing-card group flex flex-col items-center justify-center gap-4 p-8 bg-[#e63641] text-white rounded-2xl cursor-default"
            >
              <Icon className="w-10 h-10 opacity-90" strokeWidth={1.5} />
              <span className="font-semibold text-sm text-center leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment Ça Marche? ── */}
      <section className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-8">
          Comment Ça Marche?
        </h2>
        {/* Architecture diagram placeholder */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-left overflow-x-auto">
          <div className="flex flex-col gap-4 text-xs text-gray-500 font-mono">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded bg-gray-200 font-semibold text-gray-700">PC</span>
              <span>→ OCR / NLP / MySQL / Redis / FAISS</span>
              <span className="ml-auto px-3 py-1.5 rounded bg-gray-200 font-semibold text-gray-700">VR</span>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <span className="w-40 h-px bg-gray-300 flex-shrink-0" />
              <span className="px-3 py-1.5 rounded bg-[#e63641]/10 text-[#e63641] font-semibold whitespace-nowrap">
                Moteur IA
              </span>
              <span className="w-40 h-px bg-gray-300 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-3 text-center">
              {['SQLAlchemy', 'FastAPI', 'LLM API', 'Whisper', 'WebSocket / TTS'].map((t) => (
                <span key={t} className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-600 text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pourquoi Utiliser Scen-IA ── */}
      <section className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Pourquoi Utiliser Scen-IA
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          Une solution IA pour votre équipe pédagogique
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {WHY_ITEMS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 p-5 bg-[#e63641] text-white rounded-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-center leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="max-w-3xl mx-auto px-6 py-10">
        <div
          className="relative rounded-2xl overflow-hidden flex flex-col justify-end"
          style={{ minHeight: '220px', background: 'linear-gradient(135deg,#2d3748 60%,#4a5568)' }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-8">
            <h3 className="font-display text-2xl font-bold text-white mb-4">
              Pas de questions?
            </h3>
            <Link
              to={APP_ROUTES.login}
              className="inline-block bg-[#e63641] hover:bg-[#bf202f] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Commencer
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <Link
          to={APP_ROUTES.login}
          className="bg-[#e63641] hover:bg-[#bf202f] text-white px-5 py-2 rounded-lg font-semibold transition-colors"
        >
          Générer l'inscription
        </Link>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span>hello@ligne.com</span>
          <span>Instagram</span>
          <span>LinkedIn</span>
        </div>
      </footer>
    </div>
  )
}
