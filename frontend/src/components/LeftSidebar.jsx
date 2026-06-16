import { Menu } from 'lucide-react'

function LeftSidebar({
  isOpen,
  onToggle,
  onNavigate,
  onHomeClick,
  tools,
  activePath,
  ctaLabel,
  onCta,
  showFooterLinks = true,
}) {
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-lg bg-white border border-gray-300 shadow-sm hover:border-[#e63641]/40 transition-colors"
        aria-label="Afficher le bandeau"
      >
        <Menu className="h-5 w-5 text-gray-700 mx-auto" />
      </button>
    )
  }

  return (
    <aside className="w-[200px] flex-shrink-0 flex-col bg-[#e8e8e8] sticky top-0 h-screen overflow-y-auto hidden lg:flex">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="h-8 w-8 rounded-md inline-flex items-center justify-center hover:bg-white/60 transition-colors"
            aria-label="Masquer le bandeau"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={onHomeClick}
            className="font-display font-bold text-sm text-gray-900 hover:text-[#e63641] transition-colors"
          >
            Scen-IA
          </button>
        </div>
      </div>

      <div className="px-5 pt-4">
        <p className="text-xs font-semibold text-[#e63641] mb-3">Outils:</p>
        <div className="flex flex-col gap-2">
          {tools.map(({ img, label, to }) => {
            const isActive = activePath === to
            return (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(to)}
                className={`flex items-center gap-3 px-3 py-2 bg-white rounded-lg border hover:border-[#e63641]/40 hover:shadow-sm transition-all cursor-pointer ${
                  isActive ? 'border-[#e63641]/60 shadow-sm' : 'border-gray-300'
                }`}
              >
                <img src={img} alt="" className="w-5 h-5 object-contain" />
                <span className="text-[11px] text-gray-700 leading-tight whitespace-pre-line">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1" />

      <div className="px-5 pb-5 space-y-4">
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            className="w-full text-[12px] font-semibold text-white bg-[#e63641] hover:bg-[#d12e39] py-2 rounded-md transition-colors"
          >
            {ctaLabel}
          </button>
        )}

        {showFooterLinks && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="hover:text-gray-700 cursor-pointer">Contact</span>
            <span className="hover:text-gray-700 cursor-pointer">Social</span>
            <span className="hover:text-gray-700 cursor-pointer">Adresse</span>
            <span className="hover:text-gray-700 cursor-pointer">Legal Terms</span>
          </div>
        )}
      </div>
    </aside>
  )
}

export default LeftSidebar
