import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './StorageItem.styl'
import consts from 'browser/lib/consts'
import dataApi from 'browser/main/lib/dataApi'
import { store } from 'browser/main/store'
import FolderList from './FolderList'
import Handle from './Handle'
import { SortableHandle } from 'react-sortable-hoc'
import i18n from 'browser/lib/i18n'

const { shell, remote } = require('electron')
const { dialog } = remote

class StorageItem extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      isLabelEditing: false
    }
  }

  handleNewFolderButtonClick(e) {
    const { storage } = this.props
    const input = {
      name: i18n.__('New Folder'),
      color: consts.FOLDER_COLORS[Math.floor(Math.random() * 7) % 7]
    }

    dataApi
      .createFolder(storage.key, input)
      .then(data => {
        store.dispatch({
          type: 'UPDATE_FOLDER',
          storage: data.storage
        })
      })
      .catch(err => {
        console.error(err)
      })
  }

  handleExternalButtonClick() {
    const { storage } = this.props
    shell.showItemInFolder(storage.path)
  }

  handleUnlinkButtonClick(e) {
    const index = dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: i18n.__('Unlink Storage'),
      detail: i18n.__(
        'Unlinking removes this linked storage from Boostnote. No data is removed, please manually delete the folder from your hard drive if needed.'
      ),
      buttons: [i18n.__('Unlink'), i18n.__('Cancel')]
    })

    if (index === 0) {
      const { storage } = this.props
      dataApi
        .removeStorage(storage.key)
        .then(() => {
          store.dispatch({
            type: 'REMOVE_STORAGE',
            storageKey: storage.key
          })
        })
        .catch(err => {
          throw err
        })
    }
  }

  handleLabelClick(e) {
    const { storage } = this.props
    this.setState(
      {
        isLabelEditing: true,
        name: storage.name
      },
      () => {
        this.refs.label.focus()
      }
    )
  }
  handleLabelChange(e) {
    this.setState({
      name: this.refs.label.value
    })
  }

  handleLabelBlur(e) {
    const { storage } = this.props
    dataApi.renameStorage(storage.key, this.state.name).then(_storage => {
      store.dispatch({
        type: 'RENAME_STORAGE',
        storage: _storage
      })
      this.setState({
        isLabelEditing: false
      })
    })
  }

  render() {
    const { storage, hostBoundingBox } = this.props
    const StyledHandle = CSSModules(Handle, this.props.styles)

    const SortableStorageHandle = SortableHandle(StyledHandle)

    return (
      <div styleName='root' key={storage.key}>
        <div styleName='header'>
          <SortableStorageHandle isHeader />
          {this.state.isLabelEditing ? (
            <div styleName='header-label--edit'>
              <input
                styleName='header-label-input'
                value={this.state.name}
                ref='label'
                onChange={e => this.handleLabelChange(e)}
                onBlur={e => this.handleLabelBlur(e)}
              />
            </div>
          ) : (
            <div
              styleName='header-label'
              onClick={e => this.handleLabelClick(e)}
            >
              <i className='fa fa-folder-open' />
              &nbsp;
              {storage.name}&nbsp;
              <span styleName='header-label-path'>({storage.path})</span>&nbsp;
              <i styleName='header-label-editButton' className='fa fa-pencil' />
            </div>
          )}
          <div styleName='header-control'>
            <button
              styleName='header-control-button'
              onClick={e => this.handleNewFolderButtonClick(e)}
            >
              <i className='fa fa-plus' />
              <span
                styleName='header-control-button-tooltip'
                style={{ left: -20 }}
              >
                {i18n.__('Add Folder')}
              </span>
            </button>
            <button
              styleName='header-control-button'
              onClick={e => this.handleExternalButtonClick(e)}
            >
              <i className='fa fa-external-link' />
              <span
                styleName='header-control-button-tooltip'
                style={{ left: -50 }}
              >
                {i18n.__('Open Storage folder')}
              </span>
            </button>
            <button
              styleName='header-control-button'
              onClick={e => this.handleUnlinkButtonClick(e)}
            >
              <i className='fa fa-unlink' />
              <span
                styleName='header-control-button-tooltip'
                style={{ left: -10 }}
              >
                {i18n.__('Unlink')}
              </span>
            </button>
          </div>
        </div>
        <FolderList storage={storage} hostBoundingBox={hostBoundingBox} />
      </div>
    )
  }
}

StorageItem.propTypes = {
  hostBoundingBox: PropTypes.shape({
    bottom: PropTypes.number,
    height: PropTypes.number,
    left: PropTypes.number,
    right: PropTypes.number,
    top: PropTypes.number,
    width: PropTypes.number
  }),
  storage: PropTypes.shape({
    key: PropTypes.string
  })
}

export default CSSModules(StorageItem, styles)
