import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { loadDraft } from './workout/store'
import { getSettings, setSetting } from './db/settings'
import { maybeAutoRestorePoint } from './backup/restorePoint'

// A rolling safety copy of your data (at most once a day) in a separate database; never blocks startup.
setTimeout(() => { maybeAutoRestorePoint().catch(() => {}) }, 4000)

// Ask the browser not to evict our data under storage pressure, and remember when we first ran.
navigator.storage?.persist?.().catch(() => {})
getSettings().then((s) => { if (s.installedAt === null) void setSetting('installedAt', Date.now()) }).catch(() => {})

// Restore any workout in progress before first paint so reopening the app lands right back in it.
loadDraft().finally(() => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
))
