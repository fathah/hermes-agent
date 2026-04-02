import { useState } from 'react'
import { ArrowRight, ExternalLink } from '../assets/icons'

const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: '200+ models',
    tag: 'Recommended',
    envKey: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
    configProvider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    desc: 'Claude models',
    tag: '',
    envKey: 'ANTHROPIC_API_KEY',
    url: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
    configProvider: 'anthropic',
    baseUrl: '',
    needsKey: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT models',
    tag: '',
    envKey: 'OPENAI_API_KEY',
    url: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    configProvider: 'openai',
    baseUrl: '',
    needsKey: true
  },
  {
    id: 'local',
    name: 'Local LLM',
    desc: 'LM Studio, Ollama, etc.',
    tag: 'No API key needed',
    envKey: '',
    url: '',
    placeholder: '',
    configProvider: 'custom',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false
  }
]

const LOCAL_PRESETS = [
  { id: 'lmstudio', name: 'LM Studio', port: '1234' },
  { id: 'ollama', name: 'Ollama', port: '11434' },
  { id: 'vllm', name: 'vLLM', port: '8000' },
  { id: 'llamacpp', name: 'llama.cpp', port: '8080' }
]

function Setup({ onComplete }: { onComplete: () => void }): React.JSX.Element {
  const [selectedProvider, setSelectedProvider] = useState('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('http://localhost:1234/v1')
  const [modelName, setModelName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)

  const provider = PROVIDERS.find((p) => p.id === selectedProvider)!
  const isLocal = selectedProvider === 'local'

  function applyLocalPreset(port: string): void {
    setBaseUrl(`http://localhost:${port}/v1`)
  }

  async function handleContinue(): Promise<void> {
    if (provider.needsKey && !apiKey.trim()) {
      setError('Please enter an API key')
      return
    }
    if (isLocal && !baseUrl.trim()) {
      setError('Please enter the server URL')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (provider.needsKey && provider.envKey) {
        await window.hermesAPI.setEnv(provider.envKey, apiKey.trim())
      }

      const configProvider = isLocal ? 'custom' : provider.configProvider
      const configBaseUrl = isLocal ? baseUrl.trim() : provider.baseUrl
      const configModel = modelName.trim() || ''
      await window.hermesAPI.setModelConfig(configProvider, configModel, configBaseUrl)

      onComplete()
    } catch {
      setError('Failed to save configuration')
      setSaving(false)
    }
  }

  return (
    <div className="screen setup-screen">
      <h1 className="setup-title">Set Up Your AI Provider</h1>
      <p className="setup-subtitle">Choose a provider and configure it to get started</p>

      <div className="setup-provider-grid">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`setup-provider-card ${selectedProvider === p.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedProvider(p.id)
              setError('')
            }}
          >
            <div className="setup-provider-name">{p.name}</div>
            <div className="setup-provider-desc">{p.desc}</div>
            {p.tag && <div className="setup-provider-tag">{p.tag}</div>}
          </button>
        ))}
      </div>

      <div className="setup-form">
        {isLocal ? (
          <>
            <label className="setup-label">Server Preset</label>
            <div className="setup-local-presets">
              {LOCAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`setup-local-preset ${baseUrl.includes(`:${preset.port}/`) ? 'active' : ''}`}
                  onClick={() => applyLocalPreset(preset.port)}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <label className="setup-label">Server URL</label>
            <input
              className="input"
              type="text"
              placeholder="http://localhost:1234/v1"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                setError('')
              }}
              autoFocus
            />
            <div className="setup-field-hint">
              Make sure your local server is running before continuing
            </div>

            <label className="setup-label" style={{ marginTop: 16 }}>
              Model Name <span className="setup-label-optional">optional</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="e.g. llama-3.1-8b"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
            <div className="setup-field-hint">Leave blank to use the server&apos;s default model</div>
          </>
        ) : (
          <>
            <label className="setup-label">{provider.name} API Key</label>
            <div className="setup-input-group">
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                placeholder={provider.placeholder}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                autoFocus
              />
              <button
                className="setup-toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>

            <button
              className="setup-link"
              onClick={() => window.hermesAPI.openExternal(provider.url)}
            >
              Don&apos;t have a key? Get one here
              <ExternalLink size={12} />
            </button>
          </>
        )}

        {error && <div className="setup-error">{error}</div>}

        <button
          className="btn btn-primary setup-continue"
          onClick={handleContinue}
          disabled={saving || (provider.needsKey && !apiKey.trim()) || (isLocal && !baseUrl.trim())}
          style={{ marginTop: isLocal ? 20 : 0 }}
        >
          {saving ? 'Saving...' : 'Continue'}
          {!saving && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  )
}

export default Setup
