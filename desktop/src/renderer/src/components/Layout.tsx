import { useState, useCallback } from 'react'
import { useTheme } from './ThemeProvider'
import Chat, { ChatMessage } from './Chat'
import Sessions from './Sessions'
import Agents from './Agents'
import Settings from './Settings'
import Skills from './Skills'
import Soul from './Soul'
import Memory from './Memory'
import Tools from './Tools'
import hermeslogo from '../assets/hermes.png'
import {
  ChatBubble,
  Clock,
  Bot,
  Settings as SettingsIcon,
  Sun,
  Monitor,
  Moon,
  Puzzle,
  Sparkles,
  Brain,
  Wrench
} from '../assets/icons'

type View = 'chat' | 'sessions' | 'agents' | 'skills' | 'soul' | 'memory' | 'tools' | 'settings'

function Layout(): React.JSX.Element {
  const [view, setView] = useState<View>('chat')
  const { theme, setTheme } = useTheme()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState('default')

  const handleNewChat = useCallback(() => {
    setMessages([])
    setCurrentSessionId(null)
    setView('chat')
  }, [])

  const handleSelectProfile = useCallback((name: string) => {
    setActiveProfile(name)
    setMessages([])
    setCurrentSessionId(null)
  }, [])

  const handleResumeSession = useCallback(async (sessionId: string) => {
    const dbMessages = await window.hermesAPI.getSessionMessages(sessionId)
    const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
      id: `db-${m.id}`,
      role: m.role === 'user' ? 'user' : 'agent',
      content: m.content
    }))
    setMessages(chatMessages)
    setCurrentSessionId(sessionId)
    setView('chat')
  }, [])

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={hermeslogo} height={30} alt="" />
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${view === 'chat' ? 'active' : ''}`}
            onClick={() => setView('chat')}
          >
            <ChatBubble />
            Chat
          </button>
          <button
            className={`sidebar-nav-item ${view === 'sessions' ? 'active' : ''}`}
            onClick={() => setView('sessions')}
          >
            <Clock />
            Sessions
          </button>
          <button
            className={`sidebar-nav-item ${view === 'agents' ? 'active' : ''}`}
            onClick={() => setView('agents')}
          >
            <Bot />
            Agents
          </button>
          <button
            className={`sidebar-nav-item ${view === 'skills' ? 'active' : ''}`}
            onClick={() => setView('skills')}
          >
            <Puzzle />
            Skills
          </button>
          <button
            className={`sidebar-nav-item ${view === 'soul' ? 'active' : ''}`}
            onClick={() => setView('soul')}
          >
            <Sparkles />
            Persona
          </button>
          <button
            className={`sidebar-nav-item ${view === 'memory' ? 'active' : ''}`}
            onClick={() => setView('memory')}
          >
            <Brain />
            Memory
          </button>
          <button
            className={`sidebar-nav-item ${view === 'tools' ? 'active' : ''}`}
            onClick={() => setView('tools')}
          >
            <Wrench />
            Tools
          </button>
          <button
            className={`sidebar-nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            <SettingsIcon />
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="theme-switcher">
            <button
              className={`theme-switcher-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              title="Light"
            >
              <Sun size={14} />
            </button>
            <button
              className={`theme-switcher-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => setTheme('system')}
              title="System"
            >
              <Monitor size={14} />
            </button>
            <button
              className={`theme-switcher-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              title="Dark"
            >
              <Moon size={14} />
            </button>
          </div>
          <div className="sidebar-footer-text">{activeProfile === 'default' ? 'Hermes Agent' : activeProfile}</div>
        </div>
      </aside>

      <main className="content">
        <div
          style={{
            display: view === 'chat' ? 'flex' : 'none',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Chat
            messages={messages}
            setMessages={setMessages}
            sessionId={currentSessionId}
            profile={activeProfile}
          />
        </div>
        {view === 'sessions' && (
          <Sessions
            onResumeSession={handleResumeSession}
            onNewChat={handleNewChat}
            currentSessionId={currentSessionId}
          />
        )}
        {view === 'agents' && (
          <Agents
            activeProfile={activeProfile}
            onSelectProfile={handleSelectProfile}
            onChatWith={(name: string) => {
              handleSelectProfile(name)
              setView('chat')
            }}
          />
        )}
        {view === 'skills' && <Skills profile={activeProfile} />}
        {view === 'soul' && <Soul profile={activeProfile} />}
        {view === 'memory' && <Memory profile={activeProfile} />}
        {view === 'tools' && <Tools profile={activeProfile} />}
        {view === 'settings' && <Settings profile={activeProfile} />}
      </main>
    </div>
  )
}

export default Layout
