import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const hermesAPI = {
  // Installation
  checkInstall: (): Promise<{ installed: boolean; configured: boolean; hasApiKey: boolean }> =>
    ipcRenderer.invoke('check-install'),

  startInstall: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('start-install'),

  onInstallProgress: (
    callback: (progress: {
      step: number
      totalSteps: number
      title: string
      detail: string
      log: string
    }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown): void =>
      callback(
        progress as {
          step: number
          totalSteps: number
          title: string
          detail: string
          log: string
        }
      )
    ipcRenderer.on('install-progress', handler)
    return () => ipcRenderer.removeListener('install-progress', handler)
  },

  // Configuration (profile-aware)
  getEnv: (profile?: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('get-env', profile),

  setEnv: (key: string, value: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('set-env', key, value, profile),

  getConfig: (key: string, profile?: string): Promise<string | null> =>
    ipcRenderer.invoke('get-config', key, profile),

  setConfig: (key: string, value: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('set-config', key, value, profile),

  getHermesHome: (profile?: string): Promise<string> =>
    ipcRenderer.invoke('get-hermes-home', profile),

  getModelConfig: (profile?: string): Promise<{ provider: string; model: string; baseUrl: string }> =>
    ipcRenderer.invoke('get-model-config', profile),

  setModelConfig: (provider: string, model: string, baseUrl: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('set-model-config', provider, model, baseUrl, profile),

  // Chat
  sendMessage: (message: string, profile?: string): Promise<string> =>
    ipcRenderer.invoke('send-message', message, profile),

  abortChat: (): Promise<void> => ipcRenderer.invoke('abort-chat'),

  onChatChunk: (callback: (chunk: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string): void => callback(chunk)
    ipcRenderer.on('chat-chunk', handler)
    return () => ipcRenderer.removeListener('chat-chunk', handler)
  },

  onChatDone: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('chat-done', handler)
    return () => ipcRenderer.removeListener('chat-done', handler)
  },

  onChatError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.on('chat-error', handler)
    return () => ipcRenderer.removeListener('chat-error', handler)
  },

  // Gateway
  startGateway: (): Promise<boolean> => ipcRenderer.invoke('start-gateway'),
  stopGateway: (): Promise<boolean> => ipcRenderer.invoke('stop-gateway'),
  gatewayStatus: (): Promise<boolean> => ipcRenderer.invoke('gateway-status'),

  // Sessions
  listSessions: (limit?: number, offset?: number): Promise<
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
  > => ipcRenderer.invoke('list-sessions', limit, offset),

  getSessionMessages: (
    sessionId: string
  ): Promise<Array<{ id: number; role: 'user' | 'assistant'; content: string; timestamp: number }>> =>
    ipcRenderer.invoke('get-session-messages', sessionId),

  // Profiles
  listProfiles: (): Promise<
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
  > => ipcRenderer.invoke('list-profiles'),

  createProfile: (name: string, clone: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('create-profile', name, clone),

  deleteProfile: (name: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('delete-profile', name),

  setActiveProfile: (name: string): Promise<boolean> =>
    ipcRenderer.invoke('set-active-profile', name),

  // Memory
  readMemory: (profile?: string): Promise<{
    memory: { content: string; exists: boolean; lastModified: number | null }
    user: { content: string; exists: boolean; lastModified: number | null }
    stats: { totalSessions: number; totalMessages: number }
  }> => ipcRenderer.invoke('read-memory', profile),

  // Soul
  readSoul: (profile?: string): Promise<string> => ipcRenderer.invoke('read-soul', profile),
  writeSoul: (content: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('write-soul', content, profile),
  resetSoul: (profile?: string): Promise<string> => ipcRenderer.invoke('reset-soul', profile),

  // Tools
  getToolsets: (profile?: string): Promise<
    Array<{ key: string; label: string; description: string; enabled: boolean }>
  > => ipcRenderer.invoke('get-toolsets', profile),
  setToolsetEnabled: (key: string, enabled: boolean, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('set-toolset-enabled', key, enabled, profile),

  // Skills
  listInstalledSkills: (profile?: string): Promise<
    Array<{ name: string; category: string; description: string; path: string }>
  > => ipcRenderer.invoke('list-installed-skills', profile),
  listBundledSkills: (): Promise<
    Array<{ name: string; description: string; category: string; source: string; installed: boolean }>
  > => ipcRenderer.invoke('list-bundled-skills'),
  getSkillContent: (skillPath: string): Promise<string> =>
    ipcRenderer.invoke('get-skill-content', skillPath),
  installSkill: (identifier: string, profile?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('install-skill', identifier, profile),
  uninstallSkill: (name: string, profile?: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('uninstall-skill', name, profile),

  // Session search
  searchSessions: (query: string, limit?: number): Promise<
    Array<{
      sessionId: string
      title: string | null
      startedAt: number
      source: string
      messageCount: number
      model: string
      snippet: string
    }>
  > => ipcRenderer.invoke('search-sessions', query, limit),

  // Shell
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('hermesAPI', hermesAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.hermesAPI = hermesAPI
}
