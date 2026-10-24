import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from './Icons'

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{children}</h1>
      {sub && <p className="text-mute">{sub}</p>}
    </div>
  )
}

export function BackBar({ title }: { title?: string }) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center bg-bg/90 px-2 py-2 backdrop-blur">
      <button onClick={() => nav(-1)} className="flex min-h-[44px] items-center pr-3 text-accent">
        <ChevronLeft /> Back
      </button>
      {title && <div className="flex-1 pr-14 text-center font-semibold">{title}</div>}
    </div>
  )
}
