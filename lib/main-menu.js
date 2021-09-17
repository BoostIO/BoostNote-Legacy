const electron = require('electron')
const BrowserWindow = electron.BrowserWindow
const shell = electron.shell
const ipc = electron.ipcMain
const mainWindow = require('./main-window')
const os = require('os')

const macOS = process.platform === 'darwin'
// const WIN = process.platform === 'win32'
const LINUX = process.platform === 'linux'

const boost = macOS
  ? {
      label: 'Boostnote',
      submenu: [
        {
          label: 'About Boostnote',
          selector: 'orderFrontStandardAboutPanel:'
        },
        {
          type: 'separator'
        },
        {
          label: 'Preferences',
          accelerator: 'Command+,',
          click() {
            mainWindow.webContents.send('side:preferences')
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide Boostnote',
          accelerator: 'Command+H',
          selector: 'hide:'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        },
        {
          label: 'Show All',
          selector: 'unhideAllApplications:'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit Boostnote',
          role: 'quit',
          accelerator: 'CommandOrControl+Q'
        }
      ]
    }
  : {
      label: 'Boostnote',
      submenu: [
        {
          label: 'Preferences',
          accelerator: 'Control+,',
          click() {
            mainWindow.webContents.send('side:preferences')
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'quit',
          accelerator: 'Control+Q'
        }
      ]
    }

const file = {
  label: 'File',
  submenu: [
    {
      label: 'New Note',
      accelerator: 'CommandOrControl+N',
      click() {
        mainWindow.webContents.send('top:new-note')
      }
    },
    {
      label: 'Focus Note',
      accelerator: 'CommandOrControl+E',
      click() {
        mainWindow.webContents.send('detail:focus')
      }
    },
    {
      label: 'Delete Note',
      accelerator: 'CommandOrControl+Shift+Backspace',
      click() {
        mainWindow.webContents.send('detail:delete')
      }
    },
    {
      label: 'Clone Note',
      accelerator: 'CommandOrControl+D',
      click() {
        mainWindow.webContents.send('list:clone')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Import from',
      submenu: [
        {
          label: 'Plain Text, MarkDown (.txt, .md)',
          click() {
            mainWindow.webContents.send('import:file')
          }
        },
        {
          label: 'Extract comments from pdf (.pdf)',
          click() {
            mainWindow.webContents.send('import:pdfComments')
          }
        }
      ]
    },
    {
      label: 'Export as',
      submenu: [
        {
          label: 'Plain Text (.txt)',
          click() {
            mainWindow.webContents.send('list:isMarkdownNote', 'export-txt')
            mainWindow.webContents.send('export:save-text')
          }
        },
        {
          label: 'MarkDown (.md)',
          click() {
            mainWindow.webContents.send('list:isMarkdownNote', 'export-md')
            mainWindow.webContents.send('export:save-md')
          }
        },
        {
          label: 'HTML (.html)',
          click() {
            mainWindow.webContents.send('list:isMarkdownNote', 'export-html')
            mainWindow.webContents.send('export:save-html')
          }
        },
        {
          label: 'PDF (.pdf)',
          click() {
            mainWindow.webContents.send('list:isMarkdownNote', 'export-pdf')
            mainWindow.webContents.send('export:save-pdf')
          }
        }
      ]
    },
    {
      type: 'separator'
    },
    {
      label: 'Generate/Update Markdown TOC',
      accelerator: 'Shift+Ctrl+T',
      click() {
        mainWindow.webContents.send('code:generate-toc')
      }
    },
    {
      label: 'Format Table',
      click() {
        mainWindow.webContents.send('code:format-table')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Print',
      accelerator: 'CommandOrControl+P',
      click() {
        mainWindow.webContents.send('list:isMarkdownNote', 'print')
        mainWindow.webContents.send('print')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Update',
      click() {
        mainWindow.webContents.send('update')
      }
    },
    {
      type: 'separator'
    }
  ]
}

if (LINUX) {
  file.submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Preferences',
      accelerator: 'Control+,',
      click() {
        mainWindow.webContents.send('side:preferences')
      }
    },
    {
      type: 'separator'
    },
    {
      role: 'quit',
      accelerator: 'Control+Q'
    }
  )
}

const edit = {
  label: 'Edit',
  submenu: [
    {
      label: 'Undo',
      accelerator: 'Command+Z',
      selector: 'undo:'
    },
    {
      label: 'Redo',
      accelerator: 'Shift+Command+Z',
      selector: 'redo:'
    },
    {
      type: 'separator'
    },
    {
      label: 'Cut',
      accelerator: 'Command+X',
      selector: 'cut:'
    },
    {
      label: 'Copy',
      accelerator: 'Command+C',
      selector: 'copy:'
    },
    {
      label: 'Paste',
      accelerator: 'Command+V',
      selector: 'paste:'
    },
    {
      label: 'Select All',
      accelerator: 'Command+A',
      selector: 'selectAll:'
    },
    {
      type: 'separator'
    },
    {
      label: 'Add Tag',
      accelerator: 'CommandOrControl+Shift+T',
      click() {
        mainWindow.webContents.send('editor:add-tag')
      }
    }
  ]
}

const view = {
  label: 'View',
  submenu: [
    {
      label: 'Reload',
      accelerator: 'CommandOrControl+R',
      click() {
        BrowserWindow.getFocusedWindow().reload()
      }
    },
    {
      label: 'Toggle Developer Tools',
      accelerator: 'CommandOrControl+Alt+I',
      click() {
        BrowserWindow.getFocusedWindow().toggleDevTools()
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Next Note',
      accelerator: 'CommandOrControl+]',
      click() {
        mainWindow.webContents.send('list:next')
      }
    },
    {
      label: 'Previous Note',
      accelerator: 'CommandOrControl+[',
      click() {
        mainWindow.webContents.send('list:prior')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Focus Search',
      accelerator: 'CommandOrControl+Shift+L',
      click() {
        mainWindow.webContents.send('top:focus-search')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Toggle Full Screen',
      accelerator: macOS ? 'Command+Control+F' : 'F11',
      click() {
        mainWindow.setFullScreen(!mainWindow.isFullScreen())
      }
    },
    {
      label: 'Toggle Side Bar',
      accelerator: 'CommandOrControl+B',
      click() {
        mainWindow.webContents.send('editor:fullscreen')
      }
    },
    {
      label: 'Toggle Editor Orientation',
      click() {
        mainWindow.webContents.send('editor:orientation')
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Actual Size',
      accelerator: 'CommandOrControl+0',
      click() {
        mainWindow.webContents.send('status:zoomreset')
      }
    },
    {
      label: 'Zoom In',
      accelerator: 'CommandOrControl+=',
      click() {
        mainWindow.webContents.send('status:zoomin')
      }
    },
    {
      label: 'Zoom Out',
      accelerator: 'CommandOrControl+-',
      click() {
        mainWindow.webContents.send('status:zoomout')
      }
    }
  ]
}

let editorFocused

// Define extra shortcut keys
mainWindow.webContents.on('before-input-event', (event, input) => {
  // Synonyms for Search (Find)
  if (input.control && input.key === 'l' && input.type === 'keyDown') {
    if (!editorFocused) {
      mainWindow.webContents.send('top:focus-search')
      event.preventDefault()
    }
  }
})

ipc.on('editor:focused', (event, isFocused) => {
  editorFocused = isFocused
})

const window = {
  label: 'Window',
  submenu: [
    {
      label: 'Minimize',
      accelerator: 'Command+M',
      selector: 'performMiniaturize:'
    },
    {
      label: 'Close',
      accelerator: 'Command+W',
      selector: 'performClose:'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      selector: 'arrangeInFront:'
    }
  ]
}

const help = {
  label: 'Help',
  role: 'help',
  submenu: [
    {
      label: 'Boostnote official site',
      click() {
        shell.openExternal('https://boostnote.io/')
      }
    },
    {
      label: 'Wiki',
      click() {
        shell.openExternal('https://github.com/BoostIO/Boostnote/wiki')
      }
    },
    {
      label: 'Issue Tracker',
      click() {
        shell.openExternal('https://github.com/BoostIO/Boostnote/issues')
      }
    },
    {
      label: 'Changelog',
      click() {
        shell.openExternal('https://github.com/BoostIO/boost-releases')
      }
    },
    {
      label: 'Cheatsheets',
      submenu: [
        {
          label: 'Markdown',
          click() {
            shell.openExternal(
              'https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet'
            )
          }
        },
        {
          label: 'Latex',
          click() {
            shell.openExternal('https://katex.org/docs/supported.html')
          }
        },
        {
          label: 'HTML',
          click() {
            shell.openExternal('https://htmlcheatsheet.com/')
          }
        },
        {
          label: 'Boostnote',
          click() {
            shell.openExternal(
              'https://github.com/TobseF/boostnote-markdown-cheatsheet/blob/master/BOOSTNOTE_MARKDOWN_CHEAT_SHEET.md'
            )
          }
        }
      ]
    },
    {
      type: 'separator'
    },
    {
      label: 'About',
      click() {
        const version = electron.app.getVersion()
        const electronVersion = process.versions.electron
        const chromeVersion = process.versions.chrome
        const nodeVersion = process.versions.node
        const v8Version = process.versions.v8
        const OSInfo = `${os.type()} ${os.arch()} ${os.release()}`
        const detail = `Version: ${version}\nElectron: ${electronVersion}\nChrome: ${chromeVersion}\nNode.js: ${nodeVersion}\nV8: ${v8Version}\nOS: ${OSInfo}`
        electron.dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
          title: 'BoostNote',
          message: 'BoostNote',
          type: 'info',
          detail: `\n${detail}`
        })
      }
    }
  ]
}

const team = {
  label: 'For Team',
  submenu: [
    {
      label: 'BoostHub',
      click: async () => {
        shell.openExternal('https://boosthub.io/')
      }
    }
  ]
}

module.exports =
  process.platform === 'darwin'
    ? [boost, file, edit, view, window, team, help]
    : process.platform === 'win32'
    ? [boost, file, view, team, help]
    : [file, view, team, help]
