import { ElectronAPI } from '@electron-toolkit/preload'

interface InstallStatus {
  installed: boolean
  configured: boolean
  hasApiKey: boolean
  verified: boolean
}

interface InstallProgress {
  step: number
  totalSteps: number
  title: string
  detail: string
  log: string
}

interface HermesAPI {
  // Installation
  checkInstall: () => Promise<InstallStatus>
  startInstall: () => Promise<{ success: boolean; error?: string }>
  onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void

  // Configuration (profile-aware)
  getEnv: (profile?: string) => Promise<Record<string, string>>
  setEnv: (key: string, value: string, profile?: string) => Promise<boolean>
  getConfig: (key: string, profile?: string) => Promise<string | null>
  setConfig: (key: string, value: string, profile?: string) => Promise<boolean>
  getHermesHome: (profile?: string) => Promise<string>
  getModelConfig: (profile?: string) => Promise<{ provider: string; model: string; baseUrl: string }>
  setModelConfig: (provider: string, model: string, baseUrl: string, profile?: string) => Promise<boolean>

  // Chat
  sendMessage: (message: string, profile?: string) => Promise<string>
  abortChat: () => Promise<void>
  onChatChunk: (callback: (chunk: string) => void) => () => void
  onChatDone: (callback: () => void) => () => void
  onChatError: (callback: (error: string) => void) => () => void

  // Gateway
  startGateway: () => Promise<boolean>
  stopGateway: () => Promise<boolean>
  gatewayStatus: () => Promise<boolean>

  // Sessions
  listSessions: (
    limit?: number,
    offset?: number
  ) => Promise<
    Array<{
      id: string
      source: string
      startedAt: number
      endedAt: number | null
      messageCount: number
      model: string
      title: string | null
      preview: string
    }>
  >
  getSessionMessages: (
    sessionId: string
  ) => Promise<Array<{ id: number; role: 'user' | 'assistant'; content: string; timestamp: number }>>

  // Profiles
  listProfiles: () => Promise<
    Array<{
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
    }>
  >
  createProfile: (name: string, clone: boolean) => Promise<{ success: boolean; error?: string }>
  deleteProfile: (name: string) => Promise<{ success: boolean; error?: string }>
  setActiveProfile: (name: string) => Promise<boolean>

  // Shell
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    hermesAPI: HermesAPI
  }
}
