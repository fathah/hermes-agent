import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import { Refresh } from '../assets/icons'

interface MemoryProps {
  profile?: string
}

function formatRelativeTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - ts

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`

  const d = new Date(ts * 1000)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function Memory({ profile }: MemoryProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const [exists, setExists] = useState(false)
  const [lastModified, setLastModified] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMemory(): Promise<void> {
    setLoading(true)
    const info = await window.hermesAPI.readMemory(profile)
    setContent(info.content)
    setExists(info.exists)
    setLastModified(info.lastModified)
    setLoading(false)
  }

  useEffect(() => {
    loadMemory()
  }, [profile])

  if (loading) {
    return (
      <div className="memory-container">
        <div className="memory-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="memory-container">
      <div className="memory-header">
        <div>
          <h2 className="memory-title">Memory</h2>
          <p className="memory-subtitle">
            Persistent knowledge the agent has saved across conversations
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadMemory} title="Refresh">
          <Refresh size={14} />
          Refresh
        </button>
      </div>

      {!exists ? (
        <div className="memory-empty">
          <div className="memory-empty-icon">
            <Brain />
          </div>
          <p className="memory-empty-text">No memories yet</p>
          <p className="memory-empty-hint">
            The agent creates memories during conversations to remember important facts, preferences,
            and context for future sessions.
          </p>
        </div>
      ) : (
        <>
          {lastModified && (
            <div className="memory-meta">Last updated {formatRelativeTime(lastModified)}</div>
          )}
          <div className="memory-content">
            <Markdown>{content}</Markdown>
          </div>
        </>
      )}
    </div>
  )
}

function Brain(): React.JSX.Element {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  )
}

export default Memory
