import { useEffect, useState, useRef } from 'react'
import { ArrowRight } from '../assets/icons'

interface InstallProgress {
  step: number
  totalSteps: number
  title: string
  detail: string
  log: string
}

interface InstallProps {
  onComplete: () => void
  onFailed: (error: string) => void
}

function Install({ onComplete, onFailed }: InstallProps): React.JSX.Element {
  const [progress, setProgress] = useState<InstallProgress>({
    step: 0,
    totalSteps: 7,
    title: 'Preparing...',
    detail: 'Starting installation',
    log: ''
  })
  const [done, setDone] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cleanup = window.hermesAPI.onInstallProgress((p) => {
      setProgress(p)
    })

    window.hermesAPI
      .startInstall()
      .then((result) => {
        if (result.success) {
          setDone(true)
        } else {
          onFailed(result.error || 'Installation failed. Please try again or install via terminal.')
        }
      })
      .catch((err) => {
        onFailed(err.message || 'Installation failed. Please try again or install via terminal.')
      })

    return cleanup
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [progress.log])

  const percent =
    progress.totalSteps > 0 ? Math.round((progress.step / progress.totalSteps) * 100) : 0

  return (
    <div className="screen install-screen">
      <h1 className="install-title">{done ? 'Installation Complete' : 'Installing Hermes Agent'}</h1>

      <div className="install-progress-container">
        <div className="install-progress-bar">
          <div className="install-progress-fill" style={{ width: `${done ? 100 : percent}%` }} />
        </div>
        <div className="install-percent">{done ? '100' : percent}%</div>
      </div>

      {!done && (
        <div className="install-step-info">
          <div className="install-step-title">
            Step {progress.step}/{progress.totalSteps}: {progress.title}
          </div>
          <div className="install-step-detail">{progress.detail}</div>
        </div>
      )}

      <div className="install-log" ref={logRef}>
        {progress.log || 'Waiting to start...'}
      </div>

      {done && (
        <div className="install-done">
          <button className="btn btn-primary" onClick={onComplete}>
            Continue to Setup
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default Install
