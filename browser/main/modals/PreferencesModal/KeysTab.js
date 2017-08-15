import React, { PropTypes } from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './ConfigTab.styl'
import store from 'browser/main/store'
import MenuManager from 'browser/main/lib/MenuManager'

const electron = require('electron')
const ipc = electron.ipcRenderer

class HotkeyTab extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isHotkeyHintOpen: false,
      shortcuts: MenuManager.getShortcuts()
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
  }

  componentWillUnmount () {
    ipc.removeListener('APP_SETTING_DONE', this.handleSettingDone)
    ipc.removeListener('APP_SETTING_ERROR', this.handleSettingError)
  }

  handleSaveButtonClick (e) {
    MenuManager.setShortcuts(this.state.shortcuts)

    store.dispatch({
      type: 'SET_KEYS',
      keys: this.state.shortcuts
    })
  }

  handleHintToggleButtonClick (e) {
    this.setState({
      isHotkeyHintOpen: !this.state.isHotkeyHintOpen
    })
  }

  handleHotkeyChange (e) {
    let { shortcuts } = this.state
    shortcuts = {
      newNote: this.refs.newNote.value,
      focusNote: this.refs.focusNote.value,
      nextNote: this.refs.nextNote.value,
      previousNote: this.refs.previousNote.value,
      focusSearch: this.refs.focusSearch.value,
      print: this.refs.print.value,
    }
    shortcuts.hotkey = {
      toggleFinder: this.refs.toggleFinder.value,
      toggleMain: this.refs.toggleMain.value
    }
    this.setState({shortcuts: shortcuts})
  }

  render () {
    let keymapAlert = this.state.keymapAlert
    let keymapAlertElement = keymapAlert != null
      ? <p className={`alert ${keymapAlert.type}`}>
        {keymapAlert.message}
      </p>
      : null
    let { config, shortcuts } = this.state

    return (
      <div styleName='root'>
        <div styleName='group'>
          <div styleName='group-header'>Keys</div>
          <h1>Hotkeys</h1><hr />
          <div styleName='group-section'>
            <div styleName='group-section-label'>Toggle Main</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='toggleMain'
                value={shortcuts.toggleMain}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Toggle Finder(popup)</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='toggleFinder'
                value={shortcuts.toggleFinder}
                type='text'
              />
            </div>
          </div>
          <h1>Shortcuts</h1><hr />
          <div styleName='group-section'>
            <div styleName='group-section-label'>New Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='newNote'
                value={shortcuts.newNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Focus Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='focusNote'
                value={shortcuts.focusNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Next Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='nextNote'
                value={shortcuts.nextNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Previous Note</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='previousNote'
                value={shortcuts.previousNote}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Focus Search</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='focusSearch'
                value={shortcuts.focusSearch}
                type='text'
              />
            </div>
          </div>
          <div styleName='group-section'>
            <div styleName='group-section-label'>Print</div>
            <div styleName='group-section-control'>
              <input styleName='group-section-control-input'
                onChange={(e) => this.handleHotkeyChange(e)}
                ref='print'
                value={shortcuts.print}
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

HotkeyTab.propTypes = {
  dispatch: PropTypes.func
}

export default CSSModules(HotkeyTab, styles)
