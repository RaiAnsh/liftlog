import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useSettings } from './db/settings'
import Home from './screens/Home'
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
import Progress from './screens/Progress'
import { useDraft } from './workout/store'
import Settings from './screens/Settings'
import ImportScreen from './screens/ImportScreen'
import TagReview from './screens/TagReview'
import { ChartIcon, ClockIcon, DumbbellIcon, GearIcon, HomeIcon } from './components/Icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon },
  { to: '/history', label: 'History', Icon: ClockIcon },
  { to: '/progress', label: 'Progress', Icon: ChartIcon },
  { to: '/settings', label: 'Settings', Icon: GearIcon },
]

export default function App() {
  const { theme } = useSettings()
  const active = useDraft()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col">
      <main className={`flex-1 px-4 pt-3 ${active ? 'pb-56' : 'pb-32'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/routine/:id" element={<RoutineEdit />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercise/:key" element={<ExerciseDetail />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/plates" element={<Plates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/tags" element={<TagReview />} />
        </Routes>
      </main>
      <ToastHost />
      <ActiveBar />
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-[58px] max-w-xl">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-mute'}`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
