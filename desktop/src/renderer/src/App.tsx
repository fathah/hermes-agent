import { useState } from 'react'
import { ThemeProvider } from './components/ThemeProvider'
import Welcome from './components/Welcome'
import Install from './components/Install'
import Setup from './components/Setup'
import Layout from './components/Layout'

type Screen = 'loading' | 'welcome' | 'installing' | 'setup' | 'main'

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('loading')
  const [installError, setInstallError] = useState<string | null>(null)
  const isMac = window.electron?.process?.platform === 'darwin'

  // Run install check on first render only
  if (screen === 'loading') {
    window.hermesAPI
      .checkInstall()
      .then((status) => {
        if (!status.installed) {
          setScreen('welcome')
        } else if (!status.verified) {
          // Files exist but install is broken
          setInstallError(
            'Hermes is installed but appears to be broken. Try reinstalling to fix it.'
          )
          setScreen('welcome')
        } else if (!status.hasApiKey) {
          setScreen('setup')
        } else {
          setScreen('main')
        }
      })
      .catch(() => {
        setScreen('welcome')
      })
  }

  function handleInstallComplete(): void {
    setInstallError(null)
    setScreen('setup')
  }

  function handleInstallFailed(error: string): void {
    setInstallError(error)
    setScreen('welcome')
  }

  function handleRetryInstall(): void {
    setInstallError(null)
    setScreen('installing')
  }

  function handleRecheck(): void {
    setInstallError(null)
    setScreen('loading')
  }

  function renderScreen(): React.JSX.Element {
    switch (screen) {
      case 'loading':
        return (
          <div className="screen loading-screen">
            <div className="loading-spinner" />
          </div>
        )
      case 'welcome':
        return (
          <Welcome
            error={installError}
            onStart={handleRetryInstall}
            onRecheck={handleRecheck}
          />
        )
      case 'installing':
        return (
          <Install
            onComplete={handleInstallComplete}
            onFailed={handleInstallFailed}
          />
        )
      case 'setup':
        return <Setup onComplete={() => setScreen('main')} />
      case 'main':
        return <Layout />
    }
  }

  return (
    <ThemeProvider>
      <div className="app">
        {isMac && <div className="drag-region" />}
        <div className="app-content">{renderScreen()}</div>
      </div>
    </ThemeProvider>
  )
}

export default App
