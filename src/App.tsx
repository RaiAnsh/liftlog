import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useSettings } from './db/settings'
import Profile from './screens/Profile'
import History from './screens/History'
import WorkoutDetail from './screens/WorkoutDetail'
import Exercises from './screens/Exercises'
import ExerciseDetail from './screens/ExerciseDetail'
import Workout from './screens/Workout'
import Routines from './screens/Routines'
import RoutineEdit from './screens/RoutineEdit'
import ActiveBar from './components/ActiveBar'
import ToastHost from './components/ToastHost'
import Plates from './screens/Plates'
import { useDraft } from './workout/store'
import Settings from './screens/Settings'
import ImportScreen from './screens/ImportScreen'
import TagReview from './screens/TagReview'
import { ClockIcon, DumbbellIcon, ListIcon, PersonIcon } from './components/Icons'
import { PageTransition } from './components/Motion'

// Same four tabs as Strong: Profile, History, Workout, Exercises.
const TABS = [
  { to: '/profile', label: 'Profile', Icon: PersonIcon, match: ['/profile'] },
  { to: '/history', label: 'History', Icon: ClockIcon, match: ['/history'] },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon, match: ['/workout', '/routine'] },
  { to: '/exercises', label: 'Exercises', Icon: ListIcon, match: ['/exercises', '/exercise/'] },
]

export default function App() {
  const { theme } = useSettings()
  const active = useDraft()
  const { pathname } = useLocation()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col">
      <main className={`flex-1 px-4 pt-3 ${active ? 'pb-56' : 'pb-32'}`}>
        <PageTransition routeKey={pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/workout" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/routine/:id" element={<RoutineEdit />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercise/:key" element={<ExerciseDetail />} />
          <Route path="/plates" element={<Plates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/tags" element={<TagReview />} />
          <Route path="*" element={<Navigate to="/workout" replace />} />
        </Routes>
        </PageTransition>
      </main>
      <ToastHost />
      <ActiveBar />
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-[58px] max-w-xl">
          {TABS.map(({ to, label, Icon, match }) => {
            const on = match.some((m) => pathname.startsWith(m))
            return (
              <NavLink key={to} to={to} className={`relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium transition-colors ${on ? 'text-accent' : 'text-mute'}`}>
                {on && <span className="fade-in absolute top-0 h-[3px] w-8 rounded-b-full bg-accent" />}
                <span key={String(on)} className={on ? 'tab-bounce' : ''}><Icon /></span>
                {label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
