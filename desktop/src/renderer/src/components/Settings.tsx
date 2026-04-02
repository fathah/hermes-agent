import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './ThemeProvider'

interface FieldDef {
  key: string
  label: string
  type: string
  hint: string
}

interface SectionDef {
  title: string
  items: FieldDef[]
}

const SECTIONS: SectionDef[] = [
  {
    title: 'LLM Providers',
    items: [
      { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password', hint: '200+ models via OpenRouter (recommended)' },
      { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', type: 'password', hint: 'Direct access to GPT models' },
      { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', type: 'password', hint: 'Direct access to Claude models' },
      { key: 'GROQ_API_KEY', label: 'Groq API Key', type: 'password', hint: 'Ultra-fast inference (Llama, Mixtral, Gemma)' },
      { key: 'GLM_API_KEY', label: 'z.ai / GLM API Key', type: 'password', hint: 'ZhipuAI GLM models' },
      { key: 'KIMI_API_KEY', label: 'Kimi / Moonshot API Key', type: 'password', hint: 'Moonshot AI coding models' },
      { key: 'MINIMAX_API_KEY', label: 'MiniMax API Key', type: 'password', hint: 'MiniMax models (global)' },
      { key: 'MINIMAX_CN_API_KEY', label: 'MiniMax China API Key', type: 'password', hint: 'MiniMax models (China endpoint)' },
      { key: 'OPENCODE_ZEN_API_KEY', label: 'OpenCode Zen API Key', type: 'password', hint: 'Curated GPT, Claude, Gemini models' },
      { key: 'OPENCODE_GO_API_KEY', label: 'OpenCode Go API Key', type: 'password', hint: 'Open models (GLM, Kimi, MiniMax)' },
      { key: 'HF_TOKEN', label: 'Hugging Face Token', type: 'password', hint: '20+ open models via HF Inference' }
    ]
  },
  {
    title: 'Messaging Platforms',
    items: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token', type: 'password', hint: 'Get from @BotFather on Telegram' },
      { key: 'TELEGRAM_ALLOWED_USERS', label: 'Telegram Allowed Users', type: 'text', hint: 'Comma-separated Telegram user IDs' },
      { key: 'DISCORD_BOT_TOKEN', label: 'Discord Bot Token', type: 'password', hint: 'From the Discord Developer Portal' },
      { key: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token', type: 'password', hint: 'xoxb-... token from Slack app settings' }
    ]
  },
  {
    title: 'Tool API Keys',
    items: [
      { key: 'EXA_API_KEY', label: 'Exa Search API Key', type: 'password', hint: 'AI-native web search' },
      { key: 'PARALLEL_API_KEY', label: 'Parallel API Key', type: 'password', hint: 'AI-native web search and extract' },
      { key: 'TAVILY_API_KEY', label: 'Tavily API Key', type: 'password', hint: 'Web search for AI agents' },
      { key: 'FIRECRAWL_API_KEY', label: 'Firecrawl API Key', type: 'password', hint: 'Web search, extract, and crawl' },
      { key: 'FAL_KEY', label: 'FAL.ai Key', type: 'password', hint: 'Image generation with FAL.ai' },
      { key: 'HONCHO_API_KEY', label: 'Honcho API Key', type: 'password', hint: 'Cross-session AI user modeling' }
    ]
  },
  {
    title: 'Browser & Automation',
    items: [
      { key: 'BROWSERBASE_API_KEY', label: 'Browserbase API Key', type: 'password', hint: 'Cloud browser automation' },
      { key: 'BROWSERBASE_PROJECT_ID', label: 'Browserbase Project ID', type: 'text', hint: 'Project ID for Browserbase' }
    ]
  },
  {
    title: 'Voice & STT',
    items: [
      { key: 'VOICE_TOOLS_OPENAI_KEY', label: 'OpenAI Voice Key', type: 'password', hint: 'For Whisper STT and TTS' }
    ]
  },
  {
    title: 'Research & Training',
    items: [
      { key: 'TINKER_API_KEY', label: 'Tinker API Key', type: 'password', hint: 'RL training service' },
      { key: 'WANDB_API_KEY', label: 'Weights & Biases Key', type: 'password', hint: 'Experiment tracking and metrics' }
    ]
  }
]

const PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Local / Custom' }
]

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' }
]

function Settings({ profile }: { profile?: string }): React.JSX.Element {
  const [env, setEnv] = useState<Record<string, string>>({})
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [hermesHome, setHermesHome] = useState('')
  const [gatewayRunning, setGatewayRunning] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const { theme, setTheme } = useTheme()

  // Model config
  const [modelProvider, setModelProvider] = useState('auto')
  const [modelName, setModelName] = useState('')
  const [modelBaseUrl, setModelBaseUrl] = useState('')
  const [modelSaved, setModelSaved] = useState(false)
  const modelLoaded = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    modelLoaded.current = false
    loadConfig()
  }, [profile])

  // Auto-save model config when values change (debounced)
  const saveModelConfig = useCallback(async () => {
    if (!modelLoaded.current) return
    await window.hermesAPI.setModelConfig(modelProvider, modelName, modelBaseUrl, profile)
    setModelSaved(true)
    setTimeout(() => setModelSaved(false), 2000)
  }, [modelProvider, modelName, modelBaseUrl, profile])

  useEffect(() => {
    if (!modelLoaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveModelConfig()
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [modelProvider, modelName, modelBaseUrl, saveModelConfig])

  // Poll gateway status while Settings is mounted
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await window.hermesAPI.gatewayStatus()
      setGatewayRunning(status)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  async function loadConfig(): Promise<void> {
    const envData = await window.hermesAPI.getEnv(profile)
    setEnv(envData)
    const home = await window.hermesAPI.getHermesHome(profile)
    setHermesHome(home)
    const gwStatus = await window.hermesAPI.gatewayStatus()
    setGatewayRunning(gwStatus)
    const mc = await window.hermesAPI.getModelConfig(profile)
    setModelProvider(mc.provider)
    setModelName(mc.model)
    setModelBaseUrl(mc.baseUrl)
    // Mark loaded after state is set so auto-save doesn't fire on initial load
    setTimeout(() => {
      modelLoaded.current = true
    }, 600)
  }

  async function handleBlur(key: string): Promise<void> {
    const value = env[key] || ''
    await window.hermesAPI.setEnv(key, value, profile)
    setSavedKey(key)
    setTimeout(() => setSavedKey(null), 2000)
  }

  function handleChange(key: string, value: string): void {
    setEnv((prev) => ({ ...prev, [key]: value }))
  }

  function toggleVisibility(key: string): void {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function toggleGateway(): Promise<void> {
    if (gatewayRunning) {
      await window.hermesAPI.stopGateway()
      setGatewayRunning(false)
    } else {
      await window.hermesAPI.startGateway()
      setGatewayRunning(true)
    }
  }

  const isCustomProvider = modelProvider === 'custom'

  return (
    <div className="settings-container">
      <h1 className="settings-header">Settings</h1>

      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="settings-field">
          <label className="settings-field-label">Theme</label>
          <div className="settings-theme-options">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-theme-option ${theme === opt.value ? 'active' : ''}`}
                onClick={() => setTheme(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="settings-field-hint">Choose your preferred appearance</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          Model
          {modelSaved && <span className="settings-saved" style={{ marginLeft: 8 }}>Saved</span>}
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Provider</label>
          <select
            className="input settings-select"
            value={modelProvider}
            onChange={(e) => {
              const v = e.target.value
              setModelProvider(v)
              if (v === 'custom' && !modelBaseUrl) {
                setModelBaseUrl('http://localhost:1234/v1')
              }
            }}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="settings-field-hint">
            {isCustomProvider
              ? 'Use any OpenAI-compatible endpoint (LM Studio, Ollama, vLLM, etc.)'
              : 'Select your inference provider, or auto-detect from API keys'}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-field-label">Model</label>
          <input
            className="input"
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g. anthropic/claude-opus-4.6"
          />
          <div className="settings-field-hint">Default model name (leave blank for provider default)</div>
        </div>

        {isCustomProvider && (
          <div className="settings-field">
            <label className="settings-field-label">Base URL</label>
            <input
              className="input"
              type="text"
              value={modelBaseUrl}
              onChange={(e) => setModelBaseUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
            />
            <div className="settings-field-hint">OpenAI-compatible API endpoint</div>
          </div>
        )}
      </div>

      {hermesHome && (
        <div className="settings-section">
          <div className="settings-section-title">Installation</div>
          <div className="settings-field">
            <label className="settings-field-label">Hermes Home Directory</label>
            <div className="settings-field-value">{hermesHome}</div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">Gateway</div>
        <div className="settings-field">
          <label className="settings-field-label">Messaging Gateway</label>
          <div className="settings-gateway-row">
            <span className={`settings-gateway-status ${gatewayRunning ? 'running' : 'stopped'}`}>
              {gatewayRunning ? 'Running' : 'Stopped'}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={toggleGateway}>
              {gatewayRunning ? 'Stop' : 'Start'}
            </button>
          </div>
          <div className="settings-field-hint">
            Connects Hermes to Telegram, Discord, Slack, and other platforms
          </div>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="settings-section">
          <div className="settings-section-title">{section.title}</div>
          {section.items.map((field) => (
            <div key={field.key} className="settings-field">
              <label className="settings-field-label">
                {field.label}
                {savedKey === field.key && <span className="settings-saved">Saved</span>}
              </label>
              <div className="settings-input-row">
                <input
                  className="input"
                  type={field.type === 'password' && !visibleKeys.has(field.key) ? 'password' : 'text'}
                  value={env[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onBlur={() => handleBlur(field.key)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
                {field.type === 'password' && (
                  <button
                    className="btn-ghost settings-toggle-btn"
                    onClick={() => toggleVisibility(field.key)}
                  >
                    {visibleKeys.has(field.key) ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <div className="settings-field-hint">{field.hint}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default Settings
