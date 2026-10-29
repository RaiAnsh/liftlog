import { useState } from 'react'

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches

/** Shown only in iPhone Safari, before the app is installed. Safari can't prompt for this itself. */
export default function InstallHint({ dismissible }: { dismissible?: boolean }) {
  const [gone, setGone] = useState(() => { try { return localStorage.getItem('installHintDismissed') === '1' } catch { return false } })
  if (!isIos() || isStandalone() || (dismissible && gone)) return null
  return (
    <div className="card space-y-2 border border-accent/40">
      <div className="font-bold">Install LiftLog on your iPhone</div>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Tap the <b>Share</b> button in Safari (the square with an arrow).</li>
        <li>Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open LiftLog from your Home Screen. It works offline and keeps your data on this phone.</li>
      </ol>
      {dismissible && <button className="text-sm text-mute" onClick={() => { try { localStorage.setItem('installHintDismissed', '1') } catch { /* private mode */ } setGone(true) }}>Don’t show again</button>}
    </div>
  )
}
