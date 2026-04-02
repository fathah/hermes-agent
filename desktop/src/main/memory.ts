import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { HERMES_HOME } from './installer'

export interface MemoryInfo {
  memory: { content: string; exists: boolean; lastModified: number | null }
  user: { content: string; exists: boolean; lastModified: number | null }
  stats: { totalSessions: number; totalMessages: number }
}

function profileHome(profile?: string): string {
  return profile && profile !== 'default'
    ? join(HERMES_HOME, 'profiles', profile)
    : HERMES_HOME
}

function readFile(filePath: string): { content: string; exists: boolean; lastModified: number | null } {
  if (!existsSync(filePath)) {
    return { content: '', exists: false, lastModified: null }
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    const stat = statSync(filePath)
    return { content, exists: true, lastModified: Math.floor(stat.mtimeMs / 1000) }
  } catch {
    return { content: '', exists: false, lastModified: null }
  }
}

function getSessionStats(profile?: string): { totalSessions: number; totalMessages: number } {
  const home = profileHome(profile)
  const dbPath = join(home, 'state.db')
  if (!existsSync(dbPath)) return { totalSessions: 0, totalMessages: 0 }

  try {
    const db = new Database(dbPath, { readonly: true })
    try {
      const sessionRow = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number } | undefined
      const messageRow = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number } | undefined
      return {
        totalSessions: sessionRow?.count ?? 0,
        totalMessages: messageRow?.count ?? 0
      }
    } finally {
      db.close()
    }
  } catch {
    return { totalSessions: 0, totalMessages: 0 }
  }
}

export function readMemory(profile?: string): MemoryInfo {
  const home = profileHome(profile)

  return {
    memory: readFile(join(home, 'MEMORY.md')),
    user: readFile(join(home, 'USER.md')),
    stats: getSessionStats(profile)
  }
}
