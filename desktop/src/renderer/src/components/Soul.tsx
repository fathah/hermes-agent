import { useState, useEffect, useRef, useCallback } from 'react'
import { Refresh } from '../assets/icons'

interface SoulProps {
  profile?: string
}

function Soul({ profile }: SoulProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const loaded = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadSoul(): Promise<void> {
    loaded.current = false
    setLoading(true)
    const text = await window.hermesAPI.readSoul(profile)
    setContent(text)
    setLoading(false)
    setTimeout(() => {
      loaded.current = true
    }, 300)
  }

  useEffect(() => {
    loadSoul()
  }, [profile])

  const saveSoul = useCallback(
    async (text: string) => {
      if (!loaded.current) return
      await window.hermesAPI.writeSoul(text, profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    [profile]
  )

  useEffect(() => {
    if (!loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveSoul(content)
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [content, saveSoul])

  async function handleReset(): Promise<void> {
    const newContent = await window.hermesAPI.resetSoul(profile)
    loaded.current = false
    setContent(newContent)
    setShowReset(false)
    setSaved(true)
    setTimeout(() => {
      loaded.current = true
      setSaved(false)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="soul-container">
        <div className="soul-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="soul-container">
      <div className="soul-header">
        <div>
          <h2 className="soul-title">
            Persona
            {saved && <span className="soul-saved">Saved</span>}
          </h2>
          <p className="soul-subtitle">
            Define your agent&apos;s personality, tone, and instructions via SOUL.md
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowReset(true)}
          title="Reset to default"
        >
          <Refresh size={14} />
          Reset
        </button>
      </div>

      {showReset && (
        <div className="soul-reset-confirm">
          <span>Reset to the default persona? Your current content will be lost.</span>
          <div className="soul-reset-actions">
            <button className="btn btn-primary btn-sm" onClick={handleReset}>
              Reset
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReset(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <textarea
        className="soul-editor"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your agent's persona instructions here..."
        spellCheck={false}
      />

      <div className="soul-hint">
        This file is loaded fresh for every conversation. Use it to define your agent&apos;s
        personality, communication style, and any standing instructions.
      </div>
    </div>
  )
}

export default Soul
