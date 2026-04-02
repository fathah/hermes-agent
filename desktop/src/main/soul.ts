import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { HERMES_HOME } from './installer'

const DEFAULT_SOUL = `You are Hermes, a helpful AI assistant. You are friendly, knowledgeable, and always eager to help.

You communicate clearly and concisely. When asked to perform tasks, you think step-by-step and explain your reasoning. You are honest about your limitations and ask for clarification when needed.

You strive to be helpful while being safe and responsible. You respect the user's privacy and handle sensitive information carefully.
`

function profileHome(profile?: string): string {
  return profile && profile !== 'default'
    ? join(HERMES_HOME, 'profiles', profile)
    : HERMES_HOME
}

export function readSoul(profile?: string): string {
  const soulFile = join(profileHome(profile), 'SOUL.md')
  if (!existsSync(soulFile)) return ''

  try {
    return readFileSync(soulFile, 'utf-8')
  } catch {
    return ''
  }
}

export function writeSoul(content: string, profile?: string): boolean {
  const soulFile = join(profileHome(profile), 'SOUL.md')

  try {
    const dir = dirname(soulFile)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(soulFile, content)
    return true
  } catch {
    return false
  }
}

export function resetSoul(profile?: string): string {
  writeSoul(DEFAULT_SOUL, profile)
  return DEFAULT_SOUL
}
