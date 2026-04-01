import { useEffect, useState } from 'react'
import { Plus } from '../assets/icons'

interface SessionSummary {
  id: string
  source: string
  startedAt: number
  endedAt: number | null
  messageCount: number
  model: string
  title: string | null
  preview: string
}

interface SessionsProps {
  onResumeSession: (sessionId: string) => void
  onNewChat: () => void
  currentSessionId: string | null
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) return time
  if (isYesterday) return `Yesterday ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`
}

function Sessions({
  onResumeSession,
  onNewChat,
  currentSessionId
}: SessionsProps): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions(): Promise<void> {
    setLoading(false)
    const list = await window.hermesAPI.listSessions(50)
    setSessions(list)
    setLoading(false)
  }

  return (
    <div className="sessions-container">
      <div className="sessions-header">
        <h2 className="sessions-title">Sessions</h2>
        <button className="btn btn-primary " onClick={onNewChat}>
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {loading ? (
        <div className="sessions-loading">
          <div className="loading-spinner" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="sessions-empty">
          <p className="sessions-empty-text">No sessions yet</p>
          <p className="sessions-empty-hint">Start a chat to create your first session</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`sessions-item ${currentSessionId === s.id ? 'active' : ''}`}
              onClick={() => onResumeSession(s.id)}
            >
              <div className="sessions-item-top">
                <span className="sessions-item-preview">
                  {s.title || s.preview || 'Empty session'}
                </span>
                <span className="sessions-item-time">{formatDate(s.startedAt)}</span>
              </div>
              <div className="sessions-item-meta">
                <span className="sessions-item-source">{s.source}</span>
                <span className="sessions-item-dot" />
                <span>
                  {s.messageCount} msg{s.messageCount !== 1 ? 's' : ''}
                </span>
                {s.model && (
                  <>
                    <span className="sessions-item-dot" />
                    <span className="sessions-item-model">{s.model.split('/').pop()}</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default Sessions
