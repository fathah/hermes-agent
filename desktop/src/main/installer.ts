import { spawn, execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getModelConfig } from './config'

export const HERMES_HOME = join(homedir(), '.hermes')
export const HERMES_REPO = join(HERMES_HOME, 'hermes-agent')
export const HERMES_VENV = join(HERMES_REPO, 'venv')
export const HERMES_PYTHON = join(HERMES_VENV, 'bin', 'python')
export const HERMES_SCRIPT = join(HERMES_REPO, 'hermes')
export const HERMES_ENV_FILE = join(HERMES_HOME, '.env')
export const HERMES_CONFIG_FILE = join(HERMES_HOME, 'config.yaml')

export interface InstallStatus {
  installed: boolean
  configured: boolean
  hasApiKey: boolean
  verified: boolean
}

export interface InstallProgress {
  step: number
  totalSteps: number
  title: string
  detail: string
  log: string
}

export function getEnhancedPath(): string {
  const home = homedir()
  const extra = [
    join(home, '.local', 'bin'),
    join(home, '.cargo', 'bin'),
    join(HERMES_VENV, 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin'
  ]
  return [...extra, process.env.PATH || ''].join(':')
}

export function checkInstallStatus(): InstallStatus {
  const installed = existsSync(HERMES_PYTHON) && existsSync(HERMES_SCRIPT)
  const configured = existsSync(HERMES_ENV_FILE)
  let hasApiKey = false
  let verified = false

  if (installed) {
    try {
      execSync(`"${HERMES_PYTHON}" "${HERMES_SCRIPT}" --version`, {
        cwd: HERMES_REPO,
        env: { ...process.env, PATH: getEnhancedPath(), HOME: homedir(), HERMES_HOME },
        stdio: 'ignore',
        timeout: 15000
      })
      verified = true
    } catch {
      verified = false
    }
  }

  // Local/custom providers don't need an API key
  try {
    const mc = getModelConfig()
    const localProviders = ['custom', 'lmstudio', 'ollama', 'vllm', 'llamacpp']
    if (localProviders.includes(mc.provider)) {
      hasApiKey = true
    }
  } catch {
    /* ignore */
  }

  if (!hasApiKey && configured) {
    try {
      const content = readFileSync(HERMES_ENV_FILE, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#')) continue
        const match = trimmed.match(
          /^(OPENROUTER_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY)=(.+)$/
        )
        if (match && match[2].trim() && !['""', "''", ''].includes(match[2].trim())) {
          hasApiKey = true
          break
        }
      }
    } catch {
      /* ignore read errors */
    }
  }

  return { installed, configured, hasApiKey, verified }
}

function getShellProfile(home: string): string | null {
  // Check for the user's shell profile to source their PATH
  const candidates = [
    join(home, '.zshrc'),
    join(home, '.bashrc'),
    join(home, '.bash_profile'),
    join(home, '.profile')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

// Parse install.sh output to detect progress stages
const STAGE_MARKERS: { pattern: RegExp; step: number; title: string }[] = [
  { pattern: /Checking for (git|uv|python)/i, step: 1, title: 'Checking prerequisites' },
  { pattern: /Installing uv|uv found/i, step: 2, title: 'Setting up package manager' },
  { pattern: /Installing Python|Python .* found/i, step: 3, title: 'Setting up Python' },
  { pattern: /Cloning|cloning|Updating.*repository|Repository/i, step: 4, title: 'Downloading Hermes Agent' },
  { pattern: /Creating virtual|virtual environment|venv/i, step: 5, title: 'Creating Python environment' },
  { pattern: /pip install|Installing.*packages|dependencies/i, step: 6, title: 'Installing dependencies' },
  { pattern: /Configuration|config|Setup complete|Installation complete/i, step: 7, title: 'Finishing setup' }
]

function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\][^\x07]*\x07/g, '')
    .replace(/\x1B\(B/g, '')
    .replace(/\r/g, '')
}

export async function runInstall(
  onProgress: (progress: InstallProgress) => void
): Promise<void> {
  const totalSteps = 7
  let log = ''
  let currentStep = 1
  let currentTitle = 'Starting installation...'

  function emit(text: string): void {
    log += text
    // Try to detect which stage we're in from the output
    for (const marker of STAGE_MARKERS) {
      if (marker.pattern.test(text)) {
        if (marker.step >= currentStep) {
          currentStep = marker.step
          currentTitle = marker.title
        }
        break
      }
    }
    onProgress({
      step: currentStep,
      totalSteps,
      title: currentTitle,
      detail: text.trim().slice(0, 120),
      log
    })
  }

  emit('Running official Hermes install script...\n')

  return new Promise((resolve, reject) => {
    const home = homedir()

    // Source the user's shell profile to get the same PATH as their terminal,
    // then run the official install script. Electron apps launched from Finder
    // don't inherit the terminal environment.
    const shellProfile = getShellProfile(home)
    const installCmd = [
      shellProfile ? `source "${shellProfile}" 2>/dev/null;` : '',
      'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup'
    ].join(' ')

    const proc = spawn('bash', ['-c', installCmd], {
      cwd: home,
      env: {
        ...process.env,
        PATH: getEnhancedPath(),
        HOME: home,
        TERM: 'dumb'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    proc.stdout?.on('data', (data: Buffer) => {
      emit(stripAnsi(data.toString()))
    })

    proc.stderr?.on('data', (data: Buffer) => {
      emit(stripAnsi(data.toString()))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        emit('\nInstallation complete!\n')
        resolve()
      } else {
        reject(new Error(`Installation failed (exit code ${code}). You can try installing via terminal instead.`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start installer: ${err.message}`))
    })
  })
}
