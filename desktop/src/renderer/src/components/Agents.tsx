import { useState } from 'react'
import { Plus, Trash, ChatBubble } from '../assets/icons'

interface ProfileInfo {
  name: string
  path: string
  isDefault: boolean
  isActive: boolean
  model: string
  provider: string
  hasEnv: boolean
  hasSoul: boolean
  skillCount: number
  gatewayRunning: boolean
}

interface AgentsProps {
  activeProfile: string
  onSelectProfile: (name: string) => void
  onChatWith: (name: string) => void
}

type Tab = 'interactive' | 'manage'

function Agents({ activeProfile, onSelectProfile, onChatWith }: AgentsProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('interactive')
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneConfig, setCloneConfig] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadProfiles(): Promise<void> {
    const list = await window.hermesAPI.listProfiles()
    setProfiles(list)
    setLoaded(true)
  }

  if (!loaded) {
    loadProfiles()
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim().toLowerCase()
    if (!name) return

    setCreating(true)
    setError('')
    const result = await window.hermesAPI.createProfile(name, cloneConfig)
    setCreating(false)

    if (result.success) {
      setShowCreate(false)
      setNewName('')
      loadProfiles()
    } else {
      setError(result.error || 'Failed to create profile')
    }
  }

  async function handleDelete(name: string): Promise<void> {
    const result = await window.hermesAPI.deleteProfile(name)
    if (result.success) {
      if (activeProfile === name) onSelectProfile('default')
      loadProfiles()
    }
  }

  async function handleSelect(name: string): Promise<void> {
    await window.hermesAPI.setActiveProfile(name)
    onSelectProfile(name)
    loadProfiles()
  }

  function providerLabel(provider: string): string {
    if (!provider || provider === 'auto') return 'Auto'
    if (provider === 'custom') return 'Local'
    return provider.charAt(0).toUpperCase() + provider.slice(1)
  }

  if (!loaded) {
    return (
      <div className="agents-container">
        <div className="agents-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="agents-container">
      <div className="agents-header">
        <div>
          <h2 className="agents-title">Agents</h2>
          <p className="agents-subtitle">
            Each agent is an isolated Hermes instance with its own config, memory, and skills
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="agents-tabs">
        <button
          className={`agents-tab ${tab === 'interactive' ? 'active' : ''}`}
          onClick={() => setTab('interactive')}
        >
          Interactive
        </button>
        <button
          className={`agents-tab ${tab === 'manage' ? 'active' : ''}`}
          onClick={() => setTab('manage')}
        >
          Manage
        </button>
      </div>

      {/* ===== Interactive Tab ===== */}
      {tab === 'interactive' && (
        <div className="agents-interactive-grid">
          {profiles.map((p) => (
            <div
              key={p.name}
              className={`agents-interactive-card ${activeProfile === p.name ? 'active' : ''}`}
            >
              <div className="agents-interactive-avatar">
                {p.name === 'default' ? 'H' : p.name.charAt(0).toUpperCase()}
              </div>
              <div className="agents-interactive-info">
                <div className="agents-interactive-name">{p.name}</div>
                <div className="agents-interactive-model">
                  {p.model ? p.model.split('/').pop() : 'No model set'}
                </div>
                <div className="agents-interactive-meta">
                  <span>{providerLabel(p.provider)}</span>
                  <span className="agents-card-dot" />
                  <span>{p.skillCount} skills</span>
                  {p.gatewayRunning && (
                    <>
                      <span className="agents-card-dot" />
                      <span className="agents-card-gateway-on">Gateway on</span>
                    </>
                  )}
                </div>
              </div>
              <div className="agents-interactive-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onChatWith(p.name)}
                >
                  <ChatBubble size={14} />
                  Chat
                </button>
                {activeProfile === p.name ? (
                  <span className="agents-card-active-badge">Active</span>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelect(p.name)}
                  >
                    Switch
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Manage Tab ===== */}
      {tab === 'manage' && (
        <>
          <div className="agents-manage-toolbar">
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              New Agent
            </button>
          </div>

          {showCreate && (
            <div className="agents-create">
              <input
                className="input"
                placeholder="Agent name (e.g. coder)"
                value={newName}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                  setNewName(v)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <label className="agents-create-clone">
                <input
                  type="checkbox"
                  checked={cloneConfig}
                  onChange={(e) => setCloneConfig(e.target.checked)}
                />
                <span>Clone config &amp; API keys from default</span>
              </label>
              {error && <div className="agents-create-error">{error}</div>}
              <div className="agents-create-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowCreate(false)
                    setError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="agents-grid">
            {profiles.map((p) => (
              <button
                key={p.name}
                className={`agents-card ${activeProfile === p.name ? 'active' : ''}`}
                onClick={() => handleSelect(p.name)}
              >
                <div className="agents-card-header">
                  <div className="agents-card-avatar">
                    {p.name === 'default' ? 'H' : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="agents-card-info">
                    <div className="agents-card-name">{p.name}</div>
                    <div className="agents-card-provider">{providerLabel(p.provider)}</div>
                  </div>
                  {activeProfile === p.name && (
                    <span className="agents-card-active-badge">Active</span>
                  )}
                </div>

                <div className="agents-card-model">
                  {p.model ? p.model.split('/').pop() : 'No model set'}
                </div>

                <div className="agents-card-stats">
                  <span>{p.skillCount} skills</span>
                  <span className="agents-card-dot" />
                  {p.gatewayRunning ? (
                    <span className="agents-card-gateway-on">Gateway running</span>
                  ) : (
                    <span>Gateway off</span>
                  )}
                </div>

                {!p.isDefault && (
                  <button
                    className="agents-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(p.name)
                    }}
                    title="Delete agent"
                  >
                    <Trash size={14} />
                  </button>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Agents
