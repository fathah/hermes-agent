import { useEffect, useState, useRef } from 'react'
import { Plus, Search, X } from '../assets/icons'

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

interface SearchResult {
  sessionId: string
  title: string | null
  startedAt: number
  source: string
  messageCount: number
  model: string
  snippet: string
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

function highlightSnippet(snippet: string): React.JSX.Element {
  // Replace <<...>> markers from FTS5 snippet with highlighted spans
  const parts = snippet.split(/(<<.*?>>)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('<<') && part.endsWith('>>')) {
          return <mark key={i}>{part.slice(2, -2)}</mark>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function Sessions({
  onResumeSession,
  onNewChat,
  currentSessionId
}: SessionsProps): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimer.current = setTimeout(async () => {
      const results = await window.hermesAPI.searchSessions(searchQuery)
      setSearchResults(results)
      setIsSearching(false)
    }, 300)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQuery])

  async function loadSessions(): Promise<void> {
    setLoading(true)
    const list = await window.hermesAPI.listSessions(50)
    setSessions(list)
    setLoading(false)
  }

  const isShowingSearch = searchQuery.trim().length > 0

  return (
    <div className="sessions-container">
      <div className="sessions-header">
        <h2 className="sessions-title">Sessions</h2>
        <button className="btn btn-primary" onClick={onNewChat}>
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {/* Search bar */}
      <div className="sessions-search">
        <Search size={15} />
        <input
          ref={searchRef}
          className="sessions-search-input"
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="btn-ghost sessions-search-clear"
            onClick={() => {
              setSearchQuery('')
              searchRef.current?.focus()
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="sessions-loading">
          <div className="loading-spinner" />
        </div>
      ) : isShowingSearch ? (
        // Search results view
        isSearching ? (
          <div className="sessions-loading">
            <div className="loading-spinner" />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="sessions-empty">
            <p className="sessions-empty-text">No results found</p>
            <p className="sessions-empty-hint">Try different search terms</p>
          </div>
        ) : (
          <div className="sessions-list">
            {searchResults.map((r) => (
              <button
                key={r.sessionId}
                className={`sessions-item ${currentSessionId === r.sessionId ? 'active' : ''}`}
                onClick={() => onResumeSession(r.sessionId)}
              >
                <div className="sessions-item-top">
                  <span className="sessions-item-preview">
                    {r.title || `Session ${r.sessionId.slice(-6)}`}
                  </span>
                  <span className="sessions-item-time">{formatDate(r.startedAt)}</span>
                </div>
                {r.snippet && (
                  <div className="sessions-result-snippet">
                    {highlightSnippet(r.snippet)}
                  </div>
                )}
                <div className="sessions-item-meta">
                  <span className="sessions-item-source">{r.source}</span>
                  <span className="sessions-item-dot" />
                  <span>
                    {r.messageCount} msg{r.messageCount !== 1 ? 's' : ''}
                  </span>
                  {r.model && (
                    <>
                      <span className="sessions-item-dot" />
                      <span className="sessions-item-model">{r.model.split('/').pop()}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
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
