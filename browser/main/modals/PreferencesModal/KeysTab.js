import React, { PropTypes } from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './ConfigTab.styl'
import store from 'browser/main/store'
import ConfigManager from 'browser/main/lib/ConfigManager'
import KeysManager from 'browser/main/lib/KeysManager'

const electron = require('electron')
const ipc = electron.ipcRenderer

class KeysTab extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isHotkeyHintOpen: false,
      keys: KeysManager.getKeys()
    }
  }

  componentDidMount () {
    this.handleSettingDone = () => {
      this.setState({keymapAlert: {
        type: 'success',
        message: 'Successfully applied! Please restart Boostnote.'
      }})
    }
    this.handleSettingError = (err) => {
      this.setState({keymapAlert: {
        type: 'error',
        message: err.message != null ? err.message : 'Error occurs!'
      }})
    }
    ipc.addListener('APP_SETTING_DONE', this.handleSettingDone)
    ipc.addListener('APP_SETTING_ERROR', this.handleSettingError)

    // For compatibility
    const Config = require('electron-config')
    const config = new Config()
    const shortcuts = config.get('shortcutKeys')
    if (!shortcuts) this.setState({keys: Object.assign({}, this.state.keys, ConfigManager.get())})
  }

  componentWillUnmount () {
    ipc.removeListener('APP_SETTING_DONE', this.handleSettingDone)
    ipc.removeListener('APP_SETTING_ERROR', this.handleSettingError)
  }

  handleSaveButtonClick (e) {
    KeysManager.setKeys(this.state.keys)

    store.dispatch({
      type: 'SET_KEYS',
      keys: this.state.keys
    })
  }

  handleHintToggleButtonClick (e) {
    this.setState({
      isHotkeyHintOpen: !this.state.isHotkeyHintOpen
    })
  }

  handleKeysChange (e) {
    let { keys } = this.state
    keys = {
      newNote: this.refs.newNote.value,
      focusNote: this.refs.focusNote.value,
      nextNote: this.refs.nextNote.value,
      previousNote: this.refs.previousNote.value,
      deleteNote: this.refs.deleteNote.value,
      focusSearch: this.refs.focusSearch.value,
      print: this.refs.print.value,
      hotkey: {
        toggleFinder: this.refs.toggleFinder.value,
        toggleMain: this.refs.toggleMain.value
      }
    }
    this.setState({keys: keys})
  }

  render () {
    let keymapAlert = this.state.keymapAlert
    let keymapAlertElement = keymapAlert != null
      ? <p className={`alert ${keymapAlert.type}`}>
        {keymapAlert.message}
      </p>
      : null
    let { keys } = this.state

    return (
      <div styleName='root'>
        <div styleName='group'>
          <div styleName='group-header'>Keys</div>
          <h1>Hotkeys</h1><hr />
          <div styleName='group-section'>
            <div styleName='group-section-label'>Toggle Main</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='toggleMain'
                value={keys.hotkey.toggleMain}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Toggle Finder(popup)</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='toggleFinder'
                value={keys.hotkey.toggleFinder}
                type='text'
              />
            </div>
          </div>
          <h1>Shortcuts</h1><hr />
          <div styleName='group-section'>
            <div styleName='group-section-label'>New Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='newNote'
                value={keys.newNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Focus Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='focusNote'
                value={keys.focusNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Next Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='nextNote'
                value={keys.nextNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Previous Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='previousNote'
                value={keys.previousNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Delete Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='deleteNote'
                value={keys.deleteNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Focus Search</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='focusSearch'
                value={keys.focusSearch}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Print</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleKeysChange(e)}
                ref='print'
                value={keys.print}
                type='text'
              />
            </div>
          </div>

          <div styleName='group-control'>
            <button styleName='group-control-leftButton'
              onClick={(e) => this.handleHintToggleButtonClick(e)}
            >
              {this.state.isHotkeyHintOpen
                ? 'Hide Hint'
                : 'Hint?'
              }
            </button>
            <button styleName='group-control-rightButton'
              onClick={(e) => this.handleSaveButtonClick(e)}>Save
            </button>
            {keymapAlertElement}
          </div>
          {this.state.isHotkeyHintOpen &&
            <div styleName='group-hint'>
              <p>Available Keys</p>
              <ul>
                <li><code>0</code> to <code>9</code></li>
                <li><code>A</code> to <code>Z</code></li>
                <li><code>F1</code> to <code>F24</code></li>
                <li>Punctuations like <code>~</code>, <code>!</code>, <code>@</code>, <code>#</code>, <code>$</code>, etc.</li>
                <li><code>Plus</code></li>
                <li><code>Space</code></li>
                <li><code>Backspace</code></li>
                <li><code>Delete</code></li>
                <li><code>Insert</code></li>
                <li><code>Return</code> (or <code>Enter</code> as alias)</li>
                <li><code>Up</code>, <code>Down</code>, <code>Left</code> and <code>Right</code></li>
                <li><code>Home</code> and <code>End</code></li>
                <li><code>PageUp</code> and <code>PageDown</code></li>
                <li><code>Escape</code> (or <code>Esc</code> for short)</li>
                <li><code>VolumeUp</code>, <code>VolumeDown</code> and <code>VolumeMute</code></li>
                <li><code>MediaNextTrack</code>, <code>MediaPreviousTrack</code>, <code>MediaStop</code> and <code>MediaPlayPause</code></li>
                <li><code>Control</code> (or <code>Ctrl</code> for short)</li>
                <li><code>Shift</code></li>
              </ul>
            </div>
          }
        </div>
      </div>
    )
  }
}

KeysTab.propTypes = {
  dispatch: PropTypes.func
}

export default CSSModules(KeysTab, styles)
