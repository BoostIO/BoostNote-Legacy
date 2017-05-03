import React, { PropTypes } from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './StorageItem.styl'
import { hashHistory } from 'react-router'
import modal from 'browser/main/lib/modal'
import CreateFolderModal from 'browser/main/modals/CreateFolderModal'
import RenameFolderModal from 'browser/main/modals/RenameFolderModal'
import dataApi from 'browser/main/lib/dataApi'
import StorageItemChild from 'browser/components/StorageItem'
import { basePaths } from 'browser/lib/utils/paths'

const { remote } = require('electron')
const { Menu, MenuItem, dialog } = remote

class StorageItem extends React.Component {
  constructor (props) {
    super(props)

    this.handleToggleButtonClick = this.handleToggleButtonClick.bind(this)
    this.handleHeaderInfoClick = this.handleHeaderInfoClick.bind(this)
    this.handleHeaderContextMenu = this.handleHeaderContextMenu.bind(this)
    this.handleAddFolderButtonClick = this.handleAddFolderButtonClick.bind(this)
    this.folderToStorageItemChild = this.folderToStorageItemChild.bind(this)
  }

  componentDidUpdate () {
    const { location, storage, focus } = this.props

    const isActive = !!(location.pathname === basePaths.storages + storage.key)
    const isFocused = isActive && focus.sideNav
    if (isFocused) {
      this.button.focus()
    }
  }

  handleHeaderContextMenu (e) {
    let menu = new Menu()
    menu.append(new MenuItem({
      label: 'Add Folder',
      click: (e) => this.handleAddFolderButtonClick(e)
    }))
    menu.append(new MenuItem({
      type: 'separator'
    }))
    menu.append(new MenuItem({
      label: 'Unlink Storage',
      click: (e) => this.handleUnlinkStorageClick(e)
    }))
    menu.popup()
  }

  handleUnlinkStorageClick (e) {
    let index = dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: 'Unlink Storage',
      detail: 'This work will just detatches a storage from Boostnote. (Any data won\'t be deleted.)',
      buttons: ['Confirm', 'Cancel']
    })

    if (index === 0) {
      let { storage, dispatch } = this.props
      dataApi.removeStorage(storage.key)
        .then(() => {
          dispatch({
            type: 'REMOVE_STORAGE',
            storageKey: storage.key
          })
        })
        .catch((err) => {
          throw err
        })
    }
  }

  handleToggleButtonClick () {
    this.props.toggleStorageOpenness(this.props.index)
  }

  handleAddFolderButtonClick (e) {
    let { storage } = this.props

    modal.open(CreateFolderModal, {
      storage
    })
  }

  handleHeaderInfoClick (e) {
    let { storage } = this.props
    hashHistory.push('/storages/' + storage.key)
  }

  handleFolderButtonClick (folderKey) {
    return (e) => {
      let { storage } = this.props
      hashHistory.push('/storages/' + storage.key + '/folders/' + folderKey)
    }
  }

  handleFolderButtonContextMenu (e, folder) {
    let menu = new Menu()
    menu.append(new MenuItem({
      label: 'Rename Folder',
      click: (e) => this.handleRenameFolderClick(e, folder)
    }))
    menu.append(new MenuItem({
      type: 'separator'
    }))
    menu.append(new MenuItem({
      label: 'Delete Folder',
      click: (e) => this.handleFolderDeleteClick(e, folder)
    }))
    menu.popup()
  }

  handleRenameFolderClick (e, folder) {
    let { storage } = this.props
    modal.open(RenameFolderModal, {
      storage,
      folder
    })
  }

  handleFolderDeleteClick (e, folder) {
    let index = dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: 'Delete Folder',
      detail: 'This work will deletes all notes in the folder and can not be undone.',
      buttons: ['Confirm', 'Cancel']
    })

    if (index === 0) {
      let { storage, dispatch } = this.props
      dataApi
        .deleteFolder(storage.key, folder.key)
        .then((data) => {
          dispatch({
            type: 'DELETE_FOLDER',
            storage: data.storage,
            folderKey: data.folderKey
          })
        })
    }
  }

  folderToStorageItemChild (folder) {
    const { storage, location, isFolded, data, focus, handleKeyDown } = this.props
    const { folderNoteMap } = data

    const isActive = !!(location.pathname === basePaths.storages + storage.key + basePaths.folders + folder.key)
    const noteSet = folderNoteMap.get(storage.key + '-' + folder.key)
    const isFocused = isActive && focus.sideNav
    const noteCount = noteSet != null ? noteSet.size : 0

    return (
      <StorageItemChild
        key={folder.key}
        isActive={isActive}
        isFocused={isFocused}
        handleButtonClick={this.handleFolderButtonClick(folder.key)}
        handleContextMenu={(e) => this.handleFolderButtonContextMenu(e, folder)}
        folderName={folder.name}
        folderColor={folder.color}
        isFolded={isFolded}
        noteCount={noteCount}
        handleKeyDown={handleKeyDown}
      />
    )
  }

  render () {
    const { storage, location, isFolded, focus, handleKeyDown, isOpen } = this.props

    const folderList = storage.folders.map(this.folderToStorageItemChild)

    const isActive = !!(location.pathname === '/storages/' + storage.key)
    const isFocused = isActive && focus.sideNav
    const styleName = isFocused
      ? 'header--active-focused'
      : isActive ? 'header--active' : 'header'

    return (
      <div styleName={isFolded ? 'root--folded' : 'root'}
        key={storage.key}
      >
        <div styleName={styleName}
          onContextMenu={this.handleHeaderContextMenu}
        >
          <button styleName='header-toggleButton'
            onMouseDown={this.handleToggleButtonClick}
          >
            <i className={isOpen
                ? 'fa fa-caret-down'
                : 'fa fa-caret-right'
              }
            />
          </button>

          {!isFolded &&
            <button styleName='header-addFolderButton'
              onClick={this.handleAddFolderButtonClick}
            >
              <i className='fa fa-plus' />
            </button>
          }

          <button styleName='header-info'
            onClick={this.handleHeaderInfoClick}
            ref={button => { this.button = button }}
            onKeyDown={handleKeyDown}
          >
            <span styleName='header-info-name'>
              {isFolded ? storage.name.substring(0, 1) : storage.name}
            </span>
            {isFolded &&
              <span styleName='header-info--folded-tooltip'>
                {storage.name}
              </span>
            }
          </button>
        </div>
        {isOpen &&
          <div styleName='folderList' >
            {folderList}
          </div>
        }
      </div>
    )
  }
}

StorageItem.propTypes = {
  isFolded: PropTypes.bool,
  focus: PropTypes.object,
  handleKeyDown: PropTypes.func,
  toggleStorageOpenness: PropTypes.func,
  isOpen: PropTypes.bool,
  index: PropTypes.number
}

export default CSSModules(StorageItem, styles)
