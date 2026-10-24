import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Bottom sheet: thumb-reachable menus instead of tiny overflow popups. */
export default function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  // Portalled to <body> so no animated or transformed ancestor can trap or mis-position it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="fade-in absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="sheet-up relative max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card px-4 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        {title && <div className="mb-2 text-center text-lg font-bold">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetRow({ children, onClick, danger, on }: { children: React.ReactNode; onClick: () => void; danger?: boolean; on?: boolean }) {
  return (
    <button onClick={onClick} className={`row-press flex min-h-[52px] w-full items-center justify-between border-t border-line px-1 text-left text-[17px] first:border-t-0 ${danger ? 'text-red-500' : ''}`}>
      <span>{children}</span>
      {on && <span className="text-accent">✓</span>}
    </button>
  )
}
