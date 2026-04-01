import icon from '../assets/icon.png'
import { ArrowRight, Refresh, Copy } from '../assets/icons'

interface WelcomeProps {
  error: string | null
  onStart: () => void
  onRecheck: () => void
}

const INSTALL_CMD =
  'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash'

function Welcome({ error, onStart, onRecheck }: WelcomeProps): React.JSX.Element {
  return (
    <div className="screen welcome-screen">
      <img src={icon} height={40} width={40} alt="" />

      {error ? (
        <>
          <h1 className="welcome-title">Installation Issue</h1>
          <p className="welcome-subtitle">{error}</p>

          <div className="welcome-actions">
            <button className="btn btn-primary welcome-button" onClick={onStart}>
              Retry Installation
              <Refresh size={16} />
            </button>

            <div className="welcome-divider">
              <span>or</span>
            </div>

            <div className="welcome-terminal-option">
              <p className="welcome-terminal-label">Install via terminal, then come back:</p>
              <div className="welcome-terminal-box">
                <code>{INSTALL_CMD}</code>
                <button
                  className="btn-ghost welcome-copy-btn"
                  onClick={() => navigator.clipboard.writeText(INSTALL_CMD)}
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <button className="btn btn-secondary welcome-recheck-btn" onClick={onRecheck}>
              I&apos;ve installed it — check again
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="welcome-title">Welcome to Hermes</h1>
          <p className="welcome-subtitle">
            Your self-improving AI assistant that runs locally on your machine. Private, powerful, and
            always learning.
          </p>
          <button className="btn btn-primary welcome-button" onClick={onStart}>
            Get Started
            <ArrowRight size={16} />
          </button>
          <p className="welcome-note">This will install required components (~2 GB)</p>
        </>
      )}
    </div>
  )
}

export default Welcome
