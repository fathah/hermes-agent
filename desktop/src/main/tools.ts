import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { HERMES_HOME } from './installer'

export interface ToolsetInfo {
  key: string
  label: string
  description: string
  enabled: boolean
}

const TOOLSET_DEFS: { key: string; label: string; description: string }[] = [
  { key: 'web', label: 'Web Search', description: 'Search the web and extract content from URLs' },
  { key: 'browser', label: 'Browser', description: 'Navigate, click, type, and interact with web pages' },
  { key: 'terminal', label: 'Terminal', description: 'Execute shell commands and scripts' },
  { key: 'file', label: 'File Operations', description: 'Read, write, search, and manage files' },
  { key: 'code_execution', label: 'Code Execution', description: 'Execute Python and shell code directly' },
  { key: 'vision', label: 'Vision', description: 'Analyze images and visual content' },
  { key: 'image_gen', label: 'Image Generation', description: 'Generate images with DALL-E and other models' },
  { key: 'tts', label: 'Text-to-Speech', description: 'Convert text to spoken audio' },
  { key: 'skills', label: 'Skills', description: 'Create, manage, and execute reusable skills' },
  { key: 'memory', label: 'Memory', description: 'Store and recall persistent knowledge' },
  { key: 'session_search', label: 'Session Search', description: 'Search across past conversations' },
  { key: 'clarify', label: 'Clarifying Questions', description: 'Ask the user for clarification when needed' },
  { key: 'delegation', label: 'Delegation', description: 'Spawn sub-agents for parallel tasks' },
  { key: 'cronjob', label: 'Cron Jobs', description: 'Create and manage scheduled tasks' },
  { key: 'moa', label: 'Mixture of Agents', description: 'Coordinate multiple AI models together' },
  { key: 'todo', label: 'Task Planning', description: 'Create and manage to-do lists for complex tasks' }
]

function profileHome(profile?: string): string {
  return profile && profile !== 'default'
    ? join(HERMES_HOME, 'profiles', profile)
    : HERMES_HOME
}

/**
 * Parse the platform_toolsets.cli list from config.yaml.
 * The yaml structure looks like:
 *   platform_toolsets:
 *     cli:
 *       - web
 *       - browser
 *       ...
 * We use line-by-line parsing to stay consistent with config.ts (no yaml dep).
 */
function parseEnabledToolsets(configContent: string): Set<string> {
  const enabled = new Set<string>()
  const lines = configContent.split('\n')

  let inPlatformToolsets = false
  let inCli = false

  for (const line of lines) {
    const trimmed = line.trimEnd()

    // Detect section headers
    if (/^\s*platform_toolsets\s*:/.test(trimmed)) {
      inPlatformToolsets = true
      inCli = false
      continue
    }

    if (inPlatformToolsets && /^\s+cli\s*:/.test(trimmed)) {
      inCli = true
      continue
    }

    // Exit sections on un-indent
    if (inPlatformToolsets && /^\S/.test(trimmed) && !/^\s*$/.test(trimmed)) {
      inPlatformToolsets = false
      inCli = false
      continue
    }

    if (inCli && /^\s{4}\S/.test(trimmed) && !/^\s{4,}-/.test(trimmed)) {
      // A new key at the same level as cli — we've left the cli section
      inCli = false
      continue
    }

    // Parse list items inside cli:
    if (inCli) {
      const match = trimmed.match(/^\s+-\s+["']?(\w+)["']?/)
      if (match) {
        enabled.add(match[1])
      }
    }
  }

  return enabled
}

export function getToolsets(profile?: string): ToolsetInfo[] {
  const configFile = join(profileHome(profile), 'config.yaml')

  // If no config, assume all toolsets are enabled (hermes default behavior)
  if (!existsSync(configFile)) {
    return TOOLSET_DEFS.map((t) => ({ ...t, enabled: true }))
  }

  try {
    const content = readFileSync(configFile, 'utf-8')
    const enabledSet = parseEnabledToolsets(content)

    // If no platform_toolsets.cli section exists, all are enabled by default
    if (enabledSet.size === 0 && !content.includes('platform_toolsets')) {
      return TOOLSET_DEFS.map((t) => ({ ...t, enabled: true }))
    }

    return TOOLSET_DEFS.map((t) => ({
      ...t,
      enabled: enabledSet.has(t.key)
    }))
  } catch {
    return TOOLSET_DEFS.map((t) => ({ ...t, enabled: true }))
  }
}

export function setToolsetEnabled(key: string, enabled: boolean, profile?: string): boolean {
  const configFile = join(profileHome(profile), 'config.yaml')
  if (!existsSync(configFile)) return false

  try {
    const content = readFileSync(configFile, 'utf-8')
    const currentEnabled = parseEnabledToolsets(content)

    if (enabled) {
      currentEnabled.add(key)
    } else {
      currentEnabled.delete(key)
    }

    // Rebuild the platform_toolsets.cli section
    const toolsetLines = Array.from(currentEnabled)
      .sort()
      .map((t) => `      - ${t}`)
      .join('\n')

    const newSection = `  cli:\n${toolsetLines}`

    // Check if platform_toolsets section exists
    if (content.includes('platform_toolsets')) {
      // Replace existing cli section within platform_toolsets
      const lines = content.split('\n')
      const result: string[] = []
      let inPlatformToolsets = false
      let inCli = false
      let cliInserted = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trimEnd()

        if (/^\s*platform_toolsets\s*:/.test(trimmed)) {
          inPlatformToolsets = true
          result.push(line)
          continue
        }

        if (inPlatformToolsets && /^\s+cli\s*:/.test(trimmed)) {
          inCli = true
          // Output the new cli section
          result.push(newSection)
          cliInserted = true
          continue
        }

        if (inCli) {
          // Skip old list items
          if (/^\s+-\s/.test(trimmed)) continue
          // End of cli section
          if (/^\s{4}\S/.test(trimmed) || /^\S/.test(trimmed) || trimmed === '') {
            inCli = false
            if (trimmed === '' && i + 1 < lines.length && /^\S/.test(lines[i + 1].trimEnd())) {
              result.push(line)
              continue
            }
            result.push(line)
            continue
          }
          continue
        }

        if (inPlatformToolsets && /^\S/.test(trimmed) && trimmed !== '') {
          inPlatformToolsets = false
          if (!cliInserted) {
            result.push(newSection)
            cliInserted = true
          }
        }

        result.push(line)
      }

      writeFileSync(configFile, result.join('\n'))
    } else {
      // Append platform_toolsets section at end
      const newContent = content.trimEnd() + '\n\nplatform_toolsets:\n' + newSection + '\n'
      writeFileSync(configFile, newContent)
    }

    return true
  } catch {
    return false
  }
}
