import React from 'react'

/**
 * Simple modal overlay (centré, fond semi-transparent, fermeture par clic sur fond ou bouton)
 * @param {React.ReactNode} children
 * @param {function} onClose
 * @param {function} width
 * @param {function} height
 */
export default function Modal({ children, onClose, width, height }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-0 relative max-w-full"
        style={{ minWidth: 320, minHeight: 120, maxWidth: width, maxHeight: height }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-3 right-3 text-black/60 hover:text-black/90"
          onClick={onClose}
          aria-label="Fermer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        {children}
      </div>
    </div>
  )
}
