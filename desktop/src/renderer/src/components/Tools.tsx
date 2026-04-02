import { useState, useEffect } from 'react'

interface ToolsetInfo {
  key: string
  label: string
  description: string
  enabled: boolean
}

interface ToolsProps {
  profile?: string
}

function Tools({ profile }: ToolsProps): React.JSX.Element {
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([])
  const [loading, setLoading] = useState(true)

  async function loadToolsets(): Promise<void> {
    setLoading(true)
    const list = await window.hermesAPI.getToolsets(profile)
    setToolsets(list)
    setLoading(false)
  }

  useEffect(() => {
    loadToolsets()
  }, [profile])

  async function handleToggle(key: string, currentEnabled: boolean): Promise<void> {
    // Optimistic update
    setToolsets((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: !currentEnabled } : t)))
    await window.hermesAPI.setToolsetEnabled(key, !currentEnabled, profile)
  }

  if (loading) {
    return (
      <div className="tools-container">
        <div className="tools-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="tools-container">
      <div className="tools-header">
        <h2 className="tools-title">Tools</h2>
        <p className="tools-subtitle">
          Enable or disable toolsets available to the agent during conversations
        </p>
      </div>

      <div className="tools-list">
        {toolsets.map((t) => (
          <div key={t.key} className="tools-row">
            <div className="tools-row-info">
              <div className="tools-row-label">{t.label}</div>
              <div className="tools-row-description">{t.description}</div>
            </div>
            <label className="tools-toggle">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={() => handleToggle(t.key, t.enabled)}
              />
              <span className="tools-toggle-track" />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Tools
