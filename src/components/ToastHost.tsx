import { dismissToast, useToast } from '../lib/toast'
import { Confetti } from './Motion'

export default function ToastHost() {
  const t = useToast()
  if (!t) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
      <button
        key={t.id} onClick={dismissToast} role="status"
        className={`toast-in pointer-events-auto relative rounded-2xl px-5 py-3 text-left shadow-xl shadow-black/50 ${t.kind === 'pr' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black' : 'bg-card2 text-fg'}`}
      >
        {t.kind === 'pr' && <Confetti />}
        <div className="font-extrabold">{t.text}</div>
        {t.sub && <div className="text-sm font-medium opacity-80">{t.sub}</div>}
      </button>
    </div>
  )
}
