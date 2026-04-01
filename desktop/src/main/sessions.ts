import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'
import { HERMES_HOME } from './installer'

const DB_PATH = join(HERMES_HOME, 'state.db')

export interface SessionSummary {
  id: string
  source: string
  startedAt: number
  endedAt: number | null
  messageCount: number
  model: string
  title: string | null
  preview: string
}

export interface SessionMessage {
  id: number
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
}

function getDb(): Database.Database | null {
  if (!existsSync(DB_PATH)) return null
  return new Database(DB_PATH, { readonly: true })
}

export function listSessions(limit = 30, offset = 0): SessionSummary[] {
  const db = getDb()
  if (!db) return []

  try {
    const rows = db
      .prepare(
        `SELECT
          s.id,
          s.source,
          s.started_at,
          s.ended_at,
          s.message_count,
          s.model,
          s.title,
          COALESCE(
            (SELECT SUBSTR(REPLACE(REPLACE(m.content, X'0A', ' '), X'0D', ' '), 1, 80)
             FROM messages m
             WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
             ORDER BY m.timestamp, m.id LIMIT 1),
            ''
          ) AS preview
        FROM sessions s
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Array<{
      id: string
      source: string
      started_at: number
      ended_at: number | null
      message_count: number
      model: string
      title: string | null
      preview: string
    }>

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      messageCount: r.message_count,
      model: r.model || '',
      title: r.title,
      preview: r.preview
    }))
  } finally {
    db.close()
  }
}

export function getSessionMessages(sessionId: string): SessionMessage[] {
  const db = getDb()
  if (!db) return []

  try {
    const rows = db
      .prepare(
        `SELECT id, role, content, timestamp
         FROM messages
         WHERE session_id = ? AND role IN ('user', 'assistant') AND content IS NOT NULL
         ORDER BY timestamp, id`
      )
      .all(sessionId) as Array<{
      id: number
      role: string
      content: string
      timestamp: number
    }>

    return rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      timestamp: r.timestamp
    }))
  } finally {
    db.close()
  }
}
