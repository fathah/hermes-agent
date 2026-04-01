import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { HERMES_HOME, HERMES_PYTHON, HERMES_SCRIPT, getEnhancedPath } from './installer'

const PROFILES_DIR = join(HERMES_HOME, 'profiles')

export interface ProfileInfo {
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

function readProfileConfig(profilePath: string): { model: string; provider: string } {
  const configFile = join(profilePath, 'config.yaml')
  if (!existsSync(configFile)) return { model: '', provider: '' }

  try {
    const content = readFileSync(configFile, 'utf-8')
    const modelMatch = content.match(/^\s*default:\s*["']?([^"'\n#]+)["']?/m)
    const providerMatch = content.match(/^\s*provider:\s*["']?([^"'\n#]+)["']?/m)
    return {
      model: modelMatch ? modelMatch[1].trim() : '',
      provider: providerMatch ? providerMatch[1].trim() : 'auto'
    }
  } catch {
    return { model: '', provider: '' }
  }
}

function countSkills(profilePath: string): number {
  const skillsDir = join(profilePath, 'skills')
  if (!existsSync(skillsDir)) return 0
  try {
    let count = 0
    const dirs = readdirSync(skillsDir)
    for (const d of dirs) {
      const sub = join(skillsDir, d)
      if (statSync(sub).isDirectory()) {
        const inner = readdirSync(sub)
        for (const f of inner) {
          if (existsSync(join(sub, f, 'SKILL.md'))) count++
        }
      }
    }
    return count
  } catch {
    return 0
  }
}

function isGatewayRunning(profilePath: string): boolean {
  const pidFile = join(profilePath, 'gateway.pid')
  if (!existsSync(pidFile)) return false
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
    if (isNaN(pid)) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getActiveProfileName(): string {
  const activeFile = join(HERMES_HOME, 'active_profile')
  if (!existsSync(activeFile)) return 'default'
  try {
    return readFileSync(activeFile, 'utf-8').trim() || 'default'
  } catch {
    return 'default'
  }
}

export function listProfiles(): ProfileInfo[] {
  const activeName = getActiveProfileName()
  const profiles: ProfileInfo[] = []

  // Default profile is HERMES_HOME itself
  const defaultConfig = readProfileConfig(HERMES_HOME)
  profiles.push({
    name: 'default',
    path: HERMES_HOME,
    isDefault: true,
    isActive: activeName === 'default',
    model: defaultConfig.model,
    provider: defaultConfig.provider,
    hasEnv: existsSync(join(HERMES_HOME, '.env')),
    hasSoul: existsSync(join(HERMES_HOME, 'SOUL.md')),
    skillCount: countSkills(HERMES_HOME),
    gatewayRunning: isGatewayRunning(HERMES_HOME)
  })

  // Named profiles under ~/.hermes/profiles/
  if (existsSync(PROFILES_DIR)) {
    try {
      const dirs = readdirSync(PROFILES_DIR)
      for (const name of dirs) {
        const profilePath = join(PROFILES_DIR, name)
        if (!statSync(profilePath).isDirectory()) continue
        // Must have at least a config.yaml or .env to be a real profile
        if (!existsSync(join(profilePath, 'config.yaml')) && !existsSync(join(profilePath, '.env'))) continue

        const config = readProfileConfig(profilePath)
        profiles.push({
          name,
          path: profilePath,
          isDefault: false,
          isActive: activeName === name,
          model: config.model,
          provider: config.provider,
          hasEnv: existsSync(join(profilePath, '.env')),
          hasSoul: existsSync(join(profilePath, 'SOUL.md')),
          skillCount: countSkills(profilePath),
          gatewayRunning: isGatewayRunning(profilePath)
        })
      }
    } catch {
      // ignore
    }
  }

  return profiles
}

export function createProfile(name: string, clone: boolean): { success: boolean; error?: string } {
  try {
    const args = clone ? ['profile', 'create', name, '--clone'] : ['profile', 'create', name]
    execSync(`"${HERMES_PYTHON}" "${HERMES_SCRIPT}" ${args.join(' ')}`, {
      cwd: join(HERMES_HOME, 'hermes-agent'),
      env: { ...process.env, PATH: getEnhancedPath(), HOME: homedir(), HERMES_HOME },
      stdio: 'pipe',
      timeout: 15000
    })
    return { success: true }
  } catch (err) {
    const msg = (err as { stderr?: Buffer }).stderr?.toString() || (err as Error).message
    return { success: false, error: msg.trim() }
  }
}

export function deleteProfile(name: string): { success: boolean; error?: string } {
  if (name === 'default') return { success: false, error: 'Cannot delete the default profile' }
  try {
    execSync(`"${HERMES_PYTHON}" "${HERMES_SCRIPT}" profile delete ${name} --yes`, {
      cwd: join(HERMES_HOME, 'hermes-agent'),
      env: { ...process.env, PATH: getEnhancedPath(), HOME: homedir(), HERMES_HOME },
      stdio: 'pipe',
      timeout: 15000
    })
    return { success: true }
  } catch (err) {
    const msg = (err as { stderr?: Buffer }).stderr?.toString() || (err as Error).message
    return { success: false, error: msg.trim() }
  }
}

export function setActiveProfile(name: string): void {
  try {
    execSync(`"${HERMES_PYTHON}" "${HERMES_SCRIPT}" profile use ${name}`, {
      cwd: join(HERMES_HOME, 'hermes-agent'),
      env: { ...process.env, PATH: getEnhancedPath(), HOME: homedir(), HERMES_HOME },
      stdio: 'pipe',
      timeout: 10000
    })
  } catch {
    // ignore
  }
}
