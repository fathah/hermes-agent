import { ChildProcess, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { HERMES_HOME, HERMES_REPO, HERMES_PYTHON, HERMES_SCRIPT, getEnhancedPath } from './installer'
import { getModelConfig, readEnv } from './config'

function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\][^\x07]*\x07/g, '')
    .replace(/\x1B\(B/g, '')
    .replace(/\r/g, '')
}

interface ChatHandle {
  abort: () => void
}

// Filter out CLI chrome — box drawing, banner, session metadata
function isNoiseLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  // Box drawing and rules
  if (/^[╭╰│╮╯─┌┐└┘┤├┬┴┼]/.test(t)) return true
  if (/[╭╰╮╯]/.test(t) && /[─]/.test(t)) return true
  // Braille art (logo)
  if (/^[⠀-⣿]{2,}/.test(t)) return true
  // Banner content
  if (/Hermes Agent v\d/.test(t)) return true
  if (/Available Tools|Available Skills/.test(t)) return true
  if (/^\d+ tools · \d+ skills/.test(t)) return true
  if (/nousresearch\.com/i.test(t)) return true
  // Tool/skill listings
  if (/^(browser|clarify|code_execution|cronjob|delegation|file|homeassistant|honcho|memory|notification|personality|search|session|skills|terminal|tts|web|apple|autonomous|creative|data|devops|email|gaming|general|github|inference|leisure|mcp|media|mlops|note|productivity|red|research|smart|social|software):/.test(t)) return true
  if (/^\(and \d+ more/.test(t)) return true
  // Session metadata
  if (/^Session:|^session_id:|^Resume this session|^hermes --resume|^Duration:|^Messages:/.test(t)) return true
  // Status lines
  if (/^Query:|^Initializing agent/.test(t)) return true
  // Hermes response box header/footer
  if (/⚕\s*Hermes/.test(t)) return true
  return false
}

export function sendMessage(
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  profile?: string
): ChatHandle {
  // Read config from the correct profile
  const mc = getModelConfig(profile)
  const profileEnv = readEnv(profile)

  const args = [HERMES_SCRIPT]
  if (profile && profile !== 'default') {
    args.push('-p', profile)
  }
  args.push('chat', '-q', message, '--source', 'desktop')

  if (mc.model) {
    args.push('-m', mc.model)
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PATH: getEnhancedPath(),
    HOME: homedir(),
    HERMES_HOME: HERMES_HOME,
    PYTHONUNBUFFERED: '1'
  }

  // Map provider → env var for API key
  const PROVIDER_KEY_MAP: Record<string, string> = {
    custom: 'OPENAI_API_KEY',
    lmstudio: '', ollama: '', vllm: '', llamacpp: ''
  }

  const isCustomEndpoint = mc.provider in PROVIDER_KEY_MAP
  if (isCustomEndpoint && mc.baseUrl) {
    env.HERMES_INFERENCE_PROVIDER = 'custom'
    env.OPENAI_BASE_URL = mc.baseUrl.replace(/\/+$/, '')

    // Resolve the correct API key — check profile .env first, then process env
    const keyEnvVar = PROVIDER_KEY_MAP[mc.provider]
    const resolvedKey = keyEnvVar ? (profileEnv[keyEnvVar] || env[keyEnvVar] || '') : 'no-key-required'
    env.OPENAI_API_KEY = resolvedKey || 'no-key-required'

    // Remove cloud provider keys so auto-detection doesn't override
    delete env.OPENROUTER_API_KEY
    delete env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_TOKEN
    delete env.OPENROUTER_BASE_URL
  }

  const proc = spawn(HERMES_PYTHON, args, {
    cwd: HERMES_REPO,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let hasOutput = false

  function processOutput(raw: Buffer): void {
    const text = stripAnsi(raw.toString())

    // Process line by line for filtering, but preserve partial lines for streaming
    const lines = text.split('\n')
    const clean: string[] = []

    for (const line of lines) {
      // Always forward errors
      if (/❌|⚠️/.test(line)) {
        clean.push(line)
        continue
      }
      if (!isNoiseLine(line)) {
        clean.push(line)
      }
    }

    const result = clean.join('\n')
    if (result.trim()) {
      hasOutput = true
      onChunk(result)
    }
  }

  proc.stdout?.on('data', processOutput)

  proc.stderr?.on('data', (data: Buffer) => {
    const text = stripAnsi(data.toString())
    if (text.trim() && !text.includes('UserWarning') && !text.includes('FutureWarning')) {
      if (/❌|⚠️|Error|Traceback/.test(text)) {
        hasOutput = true
        onChunk(text)
      }
    }
  })

  proc.on('close', (code) => {
    if (code === 0 || hasOutput) {
      onDone()
    } else {
      onError(`Hermes exited with code ${code}`)
    }
  })

  proc.on('error', (err) => {
    onError(err.message)
  })

  return {
    abort: () => {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 3000)
    }
  }
}

// Gateway management
let gatewayProcess: ChildProcess | null = null

export function startGateway(): boolean {
  if (gatewayProcess && !gatewayProcess.killed) return false

  gatewayProcess = spawn(HERMES_PYTHON, [HERMES_SCRIPT, 'gateway'], {
    cwd: HERMES_REPO,
    env: {
      ...process.env,
      PATH: getEnhancedPath(),
      HOME: homedir(),
      HERMES_HOME: HERMES_HOME
    },
    stdio: 'ignore',
    detached: true
  })

  gatewayProcess.unref()

  gatewayProcess.on('close', () => {
    gatewayProcess = null
  })

  return true
}

export function stopGateway(): void {
  // Stop our spawned process
  if (gatewayProcess && !gatewayProcess.killed) {
    gatewayProcess.kill('SIGTERM')
    gatewayProcess = null
  }
  // Also kill via PID file (gateway may have been started externally)
  const pidFile = join(HERMES_HOME, 'gateway.pid')
  if (existsSync(pidFile)) {
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
      if (!isNaN(pid)) process.kill(pid, 'SIGTERM')
    } catch {
      // already dead
    }
  }
}

export function isGatewayRunning(): boolean {
  // Check in-memory process first
  if (gatewayProcess && !gatewayProcess.killed) return true
  // Fall back to PID file check (gateway started externally or process ref lost)
  const pidFile = join(HERMES_HOME, 'gateway.pid')
  if (!existsSync(pidFile)) return false
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
    if (isNaN(pid)) return false
    process.kill(pid, 0) // signal 0 = check if alive
    return true
  } catch {
    return false
  }
}
