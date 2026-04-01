import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { checkInstallStatus, runInstall, InstallProgress } from './installer'
import { sendMessage, startGateway, stopGateway, isGatewayRunning } from './hermes'
import {
  readEnv,
  setEnvValue,
  getConfigValue,
  setConfigValue,
  getHermesHome,
  getModelConfig,
  setModelConfig
} from './config'
import { listSessions, getSessionMessages } from './sessions'
import { listProfiles, createProfile, deleteProfile, setActiveProfile } from './profiles'

let mainWindow: BrowserWindow | null = null
let currentChatAbort: (() => void) | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIPC(): void {
  // Installation
  ipcMain.handle('check-install', () => {
    return checkInstallStatus()
  })

  ipcMain.handle('start-install', async (event) => {
    try {
      await runInstall((progress: InstallProgress) => {
        event.sender.send('install-progress', progress)
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Configuration (profile-aware)
  ipcMain.handle('get-env', (_event, profile?: string) => readEnv(profile))

  ipcMain.handle('set-env', (_event, key: string, value: string, profile?: string) => {
    setEnvValue(key, value, profile)
    return true
  })

  ipcMain.handle('get-config', (_event, key: string, profile?: string) => getConfigValue(key, profile))

  ipcMain.handle('set-config', (_event, key: string, value: string, profile?: string) => {
    setConfigValue(key, value, profile)
    return true
  })

  ipcMain.handle('get-hermes-home', (_event, profile?: string) => getHermesHome(profile))

  ipcMain.handle('get-model-config', (_event, profile?: string) => getModelConfig(profile))

  ipcMain.handle(
    'set-model-config',
    (_event, provider: string, model: string, baseUrl: string, profile?: string) => {
      setModelConfig(provider, model, baseUrl, profile)
      return true
    }
  )

  // Chat
  ipcMain.handle('send-message', (event, message: string, profile?: string) => {
    return new Promise<string>((resolve, reject) => {
      if (currentChatAbort) {
        currentChatAbort()
      }

      let fullResponse = ''

      const handle = sendMessage(
        message,
        (chunk) => {
          fullResponse += chunk
          event.sender.send('chat-chunk', chunk)
        },
        () => {
          currentChatAbort = null
          event.sender.send('chat-done')
          resolve(fullResponse)
        },
        (error) => {
          currentChatAbort = null
          event.sender.send('chat-error', error)
          reject(new Error(error))
        },
        profile
      )

      currentChatAbort = handle.abort
    })
  })

  ipcMain.handle('abort-chat', () => {
    if (currentChatAbort) {
      currentChatAbort()
      currentChatAbort = null
    }
  })

  // Gateway
  ipcMain.handle('start-gateway', () => startGateway())
  ipcMain.handle('stop-gateway', () => {
    stopGateway()
    return true
  })
  ipcMain.handle('gateway-status', () => isGatewayRunning())

  // Sessions
  ipcMain.handle('list-sessions', (_event, limit?: number, offset?: number) => {
    return listSessions(limit, offset)
  })

  ipcMain.handle('get-session-messages', (_event, sessionId: string) => {
    return getSessionMessages(sessionId)
  })

  // Profiles
  ipcMain.handle('list-profiles', () => listProfiles())
  ipcMain.handle('create-profile', (_event, name: string, clone: boolean) => createProfile(name, clone))
  ipcMain.handle('delete-profile', (_event, name: string) => deleteProfile(name))
  ipcMain.handle('set-active-profile', (_event, name: string) => {
    setActiveProfile(name)
    return true
  })

  // Shell
  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nousresearch.hermes')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopGateway()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
