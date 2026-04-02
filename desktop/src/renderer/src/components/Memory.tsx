import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import { Refresh } from '../assets/icons'

interface FileInfo {
  content: string
  exists: boolean
  lastModified: number | null
}

interface MemoryData {
  memory: FileInfo
  user: FileInfo
  stats: { totalSessions: number; totalMessages: number }
}

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
  const [data, setData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMemory(): Promise<void> {
    setLoading(true)
    const info = await window.hermesAPI.readMemory(profile)
    setData(info)
    setLoading(false)
  }

  useEffect(() => {
    loadMemory()
  }, [profile])

  if (loading || !data) {
    return (
      <div className="memory-container">
        <div className="memory-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  const hasAnyContent = data.memory.exists || data.user.exists
  const { stats } = data

  return (
    <div className="memory-container">
      <div className="memory-header">
        <div>
          <h2 className="memory-title">Memory</h2>
          <p className="memory-subtitle">
            What the agent remembers about you and past conversations
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadMemory} title="Refresh">
          <Refresh size={14} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {(stats.totalSessions > 0 || stats.totalMessages > 0) && (
        <div className="memory-stats">
          <div className="memory-stat">
            <span className="memory-stat-value">{stats.totalSessions}</span>
            <span className="memory-stat-label">sessions</span>
          </div>
          <div className="memory-stat-divider" />
          <div className="memory-stat">
            <span className="memory-stat-value">{stats.totalMessages}</span>
            <span className="memory-stat-label">messages</span>
          </div>
          <div className="memory-stat-divider" />
          <div className="memory-stat">
            <span className="memory-stat-value">
              {data.memory.exists ? data.memory.content.split('\n').filter((l) => l.startsWith('- ')).length : 0}
            </span>
            <span className="memory-stat-label">memories</span>
          </div>
        </div>
      )}

      {!hasAnyContent ? (
        <div className="memory-empty">
          <div className="memory-empty-icon">
            <BrainIcon />
          </div>
          <p className="memory-empty-text">No memories yet</p>
          <p className="memory-empty-hint">
            As you chat with Hermes, it automatically saves important facts, your preferences, and
            useful context to remember across sessions. Start a conversation to build your
            agent&apos;s memory.
          </p>
        </div>
      ) : (
        <div className="memory-sections">
          {/* User Profile section */}
          {data.user.exists && (
            <div className="memory-section">
              <div className="memory-section-header">
                <span className="memory-section-title">User Profile</span>
                {data.user.lastModified && (
                  <span className="memory-meta">
                    Updated {formatRelativeTime(data.user.lastModified)}
                  </span>
                )}
              </div>
              <div className="memory-section-hint">
                What the agent has learned about you from conversations
              </div>
              <div className="memory-content">
                <Markdown>{data.user.content}</Markdown>
              </div>
            </div>
          )}

          {/* Agent Memory section */}
          {data.memory.exists && (
            <div className="memory-section">
              <div className="memory-section-header">
                <span className="memory-section-title">Agent Memory</span>
                {data.memory.lastModified && (
                  <span className="memory-meta">
                    Updated {formatRelativeTime(data.memory.lastModified)}
                  </span>
                )}
              </div>
              <div className="memory-section-hint">
                Facts and knowledge the agent has saved for future reference
              </div>
              <div className="memory-content">
                <Markdown>{data.memory.content}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BrainIcon(): React.JSX.Element {
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
