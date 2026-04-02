import { useState, useEffect, useRef, useCallback } from 'react'
import Markdown from 'react-markdown'
import icon from '../assets/icon.png'
import { Trash, Send, Stop, Plus } from '../assets/icons'

function HermesAvatar({ size = 30 }: { size?: number }): React.JSX.Element {
  return (
    <div className="chat-avatar chat-avatar-agent">
      <img src={icon} width={size} height={size} alt="" />
    </div>
  )
}

// Shared Markdown renderer that opens links externally
function AgentMarkdown({ children }: { children: string }): React.JSX.Element {
  return (
    <Markdown
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault()
              if (href) window.hermesAPI.openExternal(href)
            }}
          >
            {children}
          </a>
        )
      }}
    >
      {children}
    </Markdown>
  )
}

export { AgentMarkdown }

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
}

interface ChatProps {
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  sessionId: string | null
  profile?: string
  onSessionStarted?: () => void
  onNewChat?: () => void
}

function Chat({
  messages,
  setMessages,
  sessionId,
  profile,
  onSessionStarted,
  onNewChat
}: ChatProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isLoadingRef = useRef(false)

  // Keep ref in sync for use in IPC callbacks
  isLoadingRef.current = isLoading

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // IPC listeners — stable callback refs, registered once
  useEffect(() => {
    const cleanupChunk = window.hermesAPI.onChatChunk((chunk) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'agent') {
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        }
        return [...prev, { id: `agent-${Date.now()}`, role: 'agent', content: chunk }]
      })
    })

    const cleanupDone = window.hermesAPI.onChatDone(() => {
      setIsLoading(false)
    })

    const cleanupError = window.hermesAPI.onChatError((error) => {
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: 'agent', content: `Error: ${error}` }
      ])
      setIsLoading(false)
    })

    return () => {
      cleanupChunk()
      cleanupDone()
      cleanupError()
    }
  }, [setMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus()
    }
  }, [isLoading])

  // Keyboard shortcut: Cmd+N for new chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        if (onNewChat) onNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNewChat])

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')

    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    setIsLoading(true)
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text }])
    onSessionStarted?.()

    try {
      await window.hermesAPI.sendMessage(text, profile)
    } catch {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setInput(e.target.value)
    const target = e.target
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
  }

  function handleAbort(): void {
    window.hermesAPI.abortChat()
    setIsLoading(false)
    // Refocus input after aborting
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleClear(): void {
    // Abort any in-flight request before clearing
    if (isLoading) {
      window.hermesAPI.abortChat()
      setIsLoading(false)
    }
    setMessages([])
  }

  const lastMessageIsAgent = messages.length > 0 && messages[messages.length - 1].role === 'agent'

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-title">
          {sessionId ? `Session ${sessionId.slice(-6)}` : 'New Chat'}
        </div>
        <div className="chat-header-actions">
          {onNewChat && (
            <button
              className="btn-ghost chat-clear-btn"
              onClick={onNewChat}
              title="New chat (Cmd+N)"
            >
              <Plus size={16} />
            </button>
          )}
          {messages.length > 0 && (
            <button
              className="btn-ghost chat-clear-btn"
              onClick={handleClear}
              title="Clear chat"
            >
              <Trash size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <HermesAvatar size={48} />
            <div className="chat-empty-text">How can I help you today?</div>
            <div className="chat-empty-hint">
              Ask me to write code, answer questions, search the web, and more
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="chat-avatar chat-avatar-user">U</div>
              ) : (
                <HermesAvatar />
              )}

              <div className={`chat-bubble chat-bubble-${msg.role}`}>
                {msg.role === 'agent' ? (
                  <AgentMarkdown>{msg.content}</AgentMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && !lastMessageIsAgent && (
          <div className="chat-message chat-message-agent">
            <HermesAvatar />
            <div className="chat-bubble chat-bubble-agent">
              <div className="chat-typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type a message... (Shift+Enter for new line)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            autoFocus
          />
          {isLoading ? (
            <button className="chat-send-btn chat-stop-btn" onClick={handleAbort} title="Stop">
              <Stop size={14} />
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat
