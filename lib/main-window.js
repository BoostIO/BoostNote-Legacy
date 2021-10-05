const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const Config = require('electron-config')
const config = new Config()
const _ = require('lodash')
const screen = electron.screen

// set up some chrome extensions
if (process.env.NODE_ENV === 'development') {
  const {
    default: installExtension,
    REACT_DEVELOPER_TOOLS,
    REACT_PERF
  } = require('electron-devtools-installer')

  require('electron-debug')({ showDevTools: false })

  const ChromeLens = {
    // ID of the extension (https://chrome.google.com/webstore/detail/chromelens/idikgljglpfilbhaboonnpnnincjhjkd)
    id: 'idikgljglpfilbhaboonnpnnincjhjkd',
    electron: '>=1.2.1'
  }

  const extensions = [REACT_DEVELOPER_TOOLS, REACT_PERF, ChromeLens]

  for (const extension of extensions) {
    try {
      installExtension(extension)
    } catch (e) {
      console.error(`[ELECTRON] Extension installation failed`, e)
    }
  }
}

const windowSize = config.get('windowsize') || {
  x: null,
  y: null,
  width: 1080,
  height: 720
}

const mainWindow = new BrowserWindow({
  x: windowSize.x,
  y: windowSize.y,
  width: windowSize.width,
  height: windowSize.height,
  useContentSize: true,
  minWidth: 500,
  minHeight: 320,
  webPreferences: {
    zoomFactor: 1.0,
    enableBlinkFeatures: 'OverlayScrollbars'
  },
  icon: path.resolve(__dirname, '../resources/app.png')
})
const url = path.resolve(
  __dirname,
  process.env.NODE_ENV === 'development'
    ? './main.development.html'
    : './main.production.html'
)

mainWindow.loadURL('file://' + url)
mainWindow.setMenuBarVisibility(false)

mainWindow.webContents.on('new-window', function(e) {
  e.preventDefault()
})

mainWindow.webContents.sendInputEvent({
  type: 'keyDown',
  keyCode: '\u0008'
})

mainWindow.webContents.sendInputEvent({
  type: 'keyUp',
  keyCode: '\u0008'
})

if (process.platform === 'darwin') {
  mainWindow.on('close', function(e) {
    e.preventDefault()
    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', function() {
        mainWindow.hide()
      })
      mainWindow.setFullScreen(false)
    } else {
      mainWindow.hide()
    }
  })

  app.on('before-quit', function(e) {
    mainWindow.removeAllListeners()
  })
}

mainWindow.on('resize', _.throttle(storeWindowSize, 500))
mainWindow.on('move', _.throttle(storeWindowSize, 500))

function storeWindowSize() {
  try {
    config.set('windowsize', mainWindow.getBounds())
  } catch (e) {
    // ignore any errors because an error occurs only on update
    // refs: https://github.com/BoostIO/Boostnote/issues/243
  }
}

app.on('activate', function() {
  if (mainWindow == null) return null
  mainWindow.show()
})

let displays = electron.screen.getAllDisplays()
// Event triggers when display is disconnected. If window is on the disconnected display, move it to main display
screen.on('display-removed', function (e) {
  const bounds = mainWindow.getBounds()
  const currentScreen = displays.getDisplayNearestPoint({x: bounds.x, y: bounds.y})
  if (displays.findIndex(display => display.id === currentScreen.id) === -1) { // window was on the removed display
    mainWindow.x = 0
    mainWindow.y = 0
    mainWindow.width = 500
    mainWindow.height = 320
    console.log('Boostnote moved to main display due to being on removed display. See main-window.js')
    displays = electron.screen.getAllDisplays()
  }
})

module.exports = mainWindow
