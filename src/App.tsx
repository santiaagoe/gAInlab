import { lazy, Suspense, useEffect, useState } from 'react'
import { IconProgress, IconSettings, IconToday } from './components/Icons'
import { Onboarding } from './screens/Onboarding'
import { SessionScreen } from './screens/Session'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'
import { StatusBanner } from './components/StatusBanner'
import type { Session } from './engine/types'
import { useApp } from './store'

const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))

type Tab = 'hoy' | 'progreso' | 'ajustes'

export default function App() {
  const { profile, plan, sessions, settings, active, notes } = useApp()
  const [tab, setTab] = useState<Tab>('hoy')
  const [redo, setRedo] = useState(false)
  const [justFinished, setJustFinished] = useState<Session | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, active?.id, redo])

  if (!profile || !plan || redo) {
    return (
      <main className="app no-nav">
        <StatusBanner />
        <Onboarding
          initial={redo ? profile : undefined}
          onCancel={redo ? () => setRedo(false) : undefined}
          key={redo ? 'redo' : 'new'}
        />
        {redo && <OnboardingDoneWatcher onDone={() => setRedo(false)} />}
      </main>
    )
  }

  if (active) {
    return (
      <main className="app no-nav">
        <StatusBanner />
        <SessionScreen
          active={active}
          plan={plan}
          profile={profile}
          settings={settings}
          notes={notes}
          onFinished={(session) => {
            setJustFinished(session)
            setTab('hoy')
          }}
        />
      </main>
    )
  }

  return (
    <>
      <main className="app">
        <StatusBanner />
        {tab === 'hoy' && (
          <Today
            plan={plan}
            sessions={sessions}
            settings={settings}
            targetDays={plan.days.length}
            age={profile.age}
            justFinished={justFinished}
            onDismissFinished={() => setJustFinished(null)}
          />
        )}
        {tab === 'progreso' && (
          <Suspense fallback={null}>
            <Progress sessions={sessions} targetDays={plan.days.length} />
          </Suspense>
        )}
        {tab === 'ajustes' && <SettingsScreen plan={plan} profile={profile} settings={settings} notes={notes} onRedoSurvey={() => setRedo(true)} />}
      </main>
      <nav className="nav" aria-label="Principal">
        <div className="nav-inner">
          <NavButton current={tab} value="hoy" label="Hoy" icon={<IconToday />} onSelect={setTab} />
          <NavButton current={tab} value="progreso" label="Progreso" icon={<IconProgress />} onSelect={setTab} />
          <NavButton current={tab} value="ajustes" label="Ajustes" icon={<IconSettings />} onSelect={setTab} />
        </div>
      </nav>
    </>
  )
}

function NavButton({
  current,
  value,
  label,
  icon,
  onSelect,
}: {
  current: Tab
  value: Tab
  label: string
  icon: React.ReactNode
  onSelect: (t: Tab) => void
}) {
  return (
    <button aria-current={current === value ? 'page' : undefined} onClick={() => onSelect(value)}>
      {icon}
      {label}
    </button>
  )
}

/** Leaves "redo survey" mode as soon as the profile changes. */
function OnboardingDoneWatcher({ onDone }: { onDone: () => void }) {
  const { profile } = useApp()
  const [initial] = useState(profile)
  useEffect(() => {
    if (profile !== initial) onDone()
  }, [profile, initial, onDone])
  return null
}
