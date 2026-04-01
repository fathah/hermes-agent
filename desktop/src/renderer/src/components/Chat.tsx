import { useState, useEffect, useRef, useCallback } from 'react'
import Markdown from 'react-markdown'
import icon from '../assets/icon.png'
import { Trash, Send, Stop } from '../assets/icons'

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
}

function Chat({
  messages,
  setMessages,
  sessionId,
  profile,
  onSessionStarted
}: ChatProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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
  }

  const lastMessageIsAgent = messages.length > 0 && messages[messages.length - 1].role === 'agent'

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-title">
          {sessionId ? `Session ${sessionId.slice(-6)}` : 'New Chat'}
        </div>
        {messages.length > 0 && (
          <button
            className="btn-ghost chat-clear-btn"
            onClick={() => setMessages([])}
            title="Clear chat"
          >
            <Trash size={16} />
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <img
              src={icon}
              width={48}
              height={48}
              alt=""
              style={{ opacity: 0.8, marginBottom: 8, borderRadius: 8 }}
            />
            <div className="chat-empty-text">How can I help you today?</div>
            <div className="chat-empty-hint">
              Ask me to write code, answer questions, search the web, and more
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              {msg.role === 'user' ? (
                <div className={`chat-avatar chat-avatar-user`}>U</div>
              ) : (
                <div>
                  <img src={icon} width={30} height={30} alt="" className="chat-avatar-agent" />
                </div>
              )}

              <div className={`chat-bubble chat-bubble-${msg.role}`}>
                {msg.role === 'agent' ? <Markdown>{msg.content}</Markdown> : msg.content}
              </div>
            </div>
          ))
        )}

        {isLoading && !lastMessageIsAgent && (
          <div className="chat-message chat-message-agent">
            <div className="chat-avatar chat-avatar-agent">H</div>
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
