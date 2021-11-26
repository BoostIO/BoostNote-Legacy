import PropTypes from 'prop-types'
import React from 'react'
import { push } from 'connected-react-router'
import CSSModules from 'browser/lib/CSSModules'
import dataApi from 'browser/main/lib/dataApi'
import styles from './SideNav.styl'
import { openModal } from 'browser/main/lib/modal'
import PreferencesModal from '../modals/PreferencesModal'
import RenameTagModal from 'browser/main/modals/RenameTagModal'
import ConfigManager from 'browser/main/lib/ConfigManager'
import StorageItem from './StorageItem'
import TagListItem from 'browser/components/TagListItem'
import SideNavFilter from 'browser/components/SideNavFilter'
import StorageList from 'browser/components/StorageList'
import NavToggleButton from 'browser/components/NavToggleButton'
import EventEmitter from 'browser/main/lib/eventEmitter'
import PreferenceButton from './PreferenceButton'
import SearchButton from './SearchButton'
import ListButton from './ListButton'
import TagButton from './TagButton'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import i18n from 'browser/lib/i18n'
import context from 'browser/lib/context'
import { remote } from 'electron'
import { confirmDeleteNote } from 'browser/lib/confirmDeleteNote'
import ColorPicker from 'browser/components/ColorPicker'
import { every, sortBy } from 'lodash'

const { dialog } = remote

function matchActiveTags(tags, activeTags) {
  return every(activeTags, v => tags.indexOf(v) >= 0)
}

class SideNav extends React.Component {
  // TODO: should not use electron stuff v0.7
  constructor(props) {
    super(props)

    this.state = {
      colorPicker: {
        show: false,
        color: null,
        tagName: null,
        targetRect: null,
        showSearch: false,
        searchText: ''
      }
    }

    this.dismissColorPicker = this.dismissColorPicker.bind(this)
    this.handleColorPickerConfirm = this.handleColorPickerConfirm.bind(this)
    this.handleColorPickerReset = this.handleColorPickerReset.bind(this)
    this.handleSearchButtonClick = this.handleSearchButtonClick.bind(this)
    this.handleSearchInputChange = this.handleSearchInputChange.bind(this)
    this.handleSearchInputClear = this.handleSearchInputClear.bind(this)
  }

  componentDidMount() {
    EventEmitter.on('side:preferences', this.handleMenuButtonClick)
  }

  componentWillUnmount() {
    EventEmitter.off('side:preferences', this.handleMenuButtonClick)
  }

  deleteTag(tag) {
    const selectedButton = dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: i18n.__('Confirm tag deletion'),
      detail: i18n.__('This will permanently remove this tag.'),
      buttons: [i18n.__('Confirm'), i18n.__('Cancel')]
    })

    if (selectedButton === 0) {
      const {
        data,
        dispatch,
        location,
        match: { params }
      } = this.props

      const notes = data.noteMap
        .map(note => note)
        .filter(note => note.tags.indexOf(tag) !== -1)
        .map(note => {
          note = Object.assign({}, note)
          note.tags = note.tags.slice()

          note.tags.splice(note.tags.indexOf(tag), 1)

          return note
        })

      Promise.all(
        notes.map(note => dataApi.updateNote(note.storage, note.key, note))
      ).then(updatedNotes => {
        updatedNotes.forEach(note => {
          dispatch({
            type: 'UPDATE_NOTE',
            note
          })
        })

        if (location.pathname.match('/tags')) {
          const tags = params.tagname.split(' ')
          const index = tags.indexOf(tag)
          if (index !== -1) {
            tags.splice(index, 1)

            dispatch(
              push(
                `/tags/${tags.map(tag => encodeURIComponent(tag)).join(' ')}`
              )
            )
          }
        }
      })
    }
  }

  handleMenuButtonClick(e) {
    openModal(PreferencesModal)
  }

  handleSearchButtonClick(e) {
    const { showSearch } = this.state
    this.setState({
      showSearch: !showSearch,
      searchText: ''
    })
  }

  handleSearchInputClear(e) {
    this.setState({
      searchText: ''
    })
  }

  handleSearchInputChange(e) {
    this.setState({
      searchText: e.target.value
    })
  }

  handleHomeButtonClick(e) {
    const { dispatch } = this.props
    dispatch(push('/home'))
  }

  handleStarredButtonClick(e) {
    const { dispatch } = this.props
    dispatch(push('/starred'))
  }

  handleTagContextMenu(e, tag) {
    context.popup([
      {
        label: i18n.__('Rename Tag'),
        click: this.handleRenameTagClick.bind(this, tag)
      },
      {
        label: i18n.__('Customize Color'),
        click: this.displayColorPicker.bind(
          this,
          tag,
          e.target.getBoundingClientRect()
        )
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('Export Tag'),
        submenu: [
          {
            label: i18n.__('Export as Plain Text (.txt)'),
            click: e => this.handleExportTagClick(e, tag, 'txt')
          },
          {
            label: i18n.__('Export as Markdown (.md)'),
            click: e => this.handleExportTagClick(e, tag, 'md')
          },
          {
            label: i18n.__('Export as HTML (.html)'),
            click: e => this.handleExportTagClick(e, tag, 'html')
          },
          {
            label: i18n.__('Export as PDF (.pdf)'),
            click: e => this.handleExportTagClick(e, tag, 'pdf')
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('Delete Tag'),
        click: this.deleteTag.bind(this, tag)
      }
    ])
  }

  handleExportTagClick(e, tag, fileType) {
    const options = {
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: i18n.__('Select directory'),
      title: i18n.__('Select a folder to export the files to'),
      multiSelections: false
    }
    dialog.showOpenDialog(remote.getCurrentWindow(), options, paths => {
      if (paths && paths.length === 1) {
        const { data, config } = this.props
        dataApi
          .exportTag(data, tag, fileType, paths[0], config)
          .then(data => {
            dialog.showMessageBox(remote.getCurrentWindow(), {
              type: 'info',
              message: `Exported to ${paths[0]}`
            })
          })
          .catch(error => {
            dialog.showErrorBox(
              'Export error',
              error ? error.message || error : 'Unexpected error during export'
            )
            throw error
          })
      }
    })
  }

  dismissColorPicker() {
    this.setState({
      colorPicker: {
        show: false
      }
    })
  }

  displayColorPicker(tagName, rect) {
    const { config } = this.props
    this.setState({
      colorPicker: {
        show: true,
        color: config.coloredTags[tagName],
        tagName,
        targetRect: rect
      }
    })
  }

  handleRenameTagClick(tagName) {
    const { data, dispatch } = this.props

    openModal(RenameTagModal, {
      tagName,
      data,
      dispatch
    })
  }

  handleColorPickerConfirm(color) {
    const {
      dispatch,
      config: { coloredTags }
    } = this.props
    const {
      colorPicker: { tagName }
    } = this.state
    const newColoredTags = Object.assign({}, coloredTags, {
      [tagName]: color.hex
    })

    const config = { coloredTags: newColoredTags }
    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
    this.dismissColorPicker()
  }

  handleColorPickerReset() {
    const {
      dispatch,
      config: { coloredTags }
    } = this.props
    const {
      colorPicker: { tagName }
    } = this.state
    const newColoredTags = Object.assign({}, coloredTags)

    delete newColoredTags[tagName]

    const config = { coloredTags: newColoredTags }
    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
    this.dismissColorPicker()
  }

  handleToggleButtonClick(e) {
    const { dispatch, config } = this.props
    const { showSearch, searchText } = this.state

    ConfigManager.set({ isSideNavFolded: !config.isSideNavFolded })
    dispatch({
      type: 'SET_IS_SIDENAV_FOLDED',
      isFolded: !config.isSideNavFolded
    })

    if (showSearch && searchText.length === 0) {
      this.setState({
        showSearch: false
      })
    }
  }

  handleTrashedButtonClick(e) {
    const { dispatch } = this.props
    dispatch(push('/trashed'))
  }

  handleSwitchFoldersButtonClick() {
    const { dispatch } = this.props
    dispatch(push('/home'))
  }

  handleSwitchTagsButtonClick() {
    const { dispatch } = this.props
    dispatch(push('/alltags'))
  }

  onSortEnd(storage) {
    return ({ oldIndex, newIndex }) => {
      const { dispatch } = this.props
      dataApi.reorderFolder(storage.key, oldIndex, newIndex).then(data => {
        dispatch({ type: 'REORDER_FOLDER', storage: data.storage })
      })
    }
  }

  onStorageSortEnd({ oldIndex, newIndex }) {
    const { dispatch } = this.props
    dataApi.reorderStorage(oldIndex, newIndex).then(data => {
      dispatch({ type: 'REORDER_STORAGE', storages: data.storages })
    })
  }

  SideNavComponent(isFolded) {
    const { location, data, config, dispatch } = this.props
    const { showSearch, searchText } = this.state

    const isHomeActive = !!location.pathname.match(/^\/home$/)
    const isStarredActive = !!location.pathname.match(/^\/starred$/)
    const isTrashedActive = !!location.pathname.match(/^\/trashed$/)
    const SortableStorageList = SortableContainer(StorageList)

    let component

    // TagsMode is not selected
    if (
      !location.pathname.match('/tags') &&
      !location.pathname.match('/alltags')
    ) {
      let storageMap = data.storageMap
      if (showSearch && searchText.length > 0) {
        storageMap = storageMap.map(storage => {
          const folders = storage.folders.filter(
            folder =>
              folder.name.toLowerCase().indexOf(searchText.toLowerCase()) !== -1
          )
          return Object.assign({}, storage, { folders })
        })
      }

      let itemIndex = -1

      const storageList = storageMap.map((storage, key) => {
        const SortableStorageItem = SortableElement(
          SortableContainer(StorageItem)
        )
        itemIndex++
        return (
          <SortableStorageItem
            key={storage.key}
            index={itemIndex}
            storage={storage}
            data={data}
            location={location}
            isFolded={isFolded}
            dispatch={dispatch}
            onSortEnd={this.onSortEnd.bind(this)(storage)}
            useDragHandle
            config={config}
          />
        )
      })

      component = (
        <div>
          <SideNavFilter
            isFolded={isFolded}
            isHomeActive={isHomeActive}
            handleAllNotesButtonClick={e => this.handleHomeButtonClick(e)}
            isStarredActive={isStarredActive}
            isTrashedActive={isTrashedActive}
            handleStarredButtonClick={e => this.handleStarredButtonClick(e)}
            handleTrashedButtonClick={e => this.handleTrashedButtonClick(e)}
            counterTotalNote={
              data.noteMap._map.size - data.trashedSet._set.size
            }
            counterStarredNote={data.starredSet._set.size}
            counterDelNote={data.trashedSet._set.size}
            handleFilterButtonContextMenu={this.handleFilterButtonContextMenu.bind(
              this
            )}
          />

          <SortableStorageList
            storageList={storageList}
            isFolded={isFolded}
            onSortEnd={this.onStorageSortEnd.bind(this)}
            useDragHandle
          />
          <NavToggleButton
            isFolded={isFolded}
            handleToggleButtonClick={this.handleToggleButtonClick.bind(this)}
          />
        </div>
      )
    } else {
      component = (
        <div styleName='tabBody'>
          <div styleName='tag-control'>
            <div styleName='tag-control-title'>
              <p>{i18n.__('Tags')}</p>
            </div>
            <div styleName='tag-control-sortTagsBy'>
              <i className='fa fa-angle-down' />
              <select
                styleName='tag-control-sortTagsBy-select'
                title={i18n.__('Select filter mode')}
                value={config.sortTagsBy}
                onChange={e => this.handleSortTagsByChange(e)}
              >
                <option title='Sort alphabetically' value='ALPHABETICAL'>
                  {i18n.__('Alphabetically')}
                </option>
                <option title='Sort by update time' value='COUNTER'>
                  {i18n.__('Counter')}
                </option>
              </select>
            </div>
          </div>
          <div styleName='tagList'>{this.tagListComponent(data)}</div>
          <NavToggleButton
            isFolded={isFolded}
            handleToggleButtonClick={this.handleToggleButtonClick.bind(this)}
          />
        </div>
      )
    }

    return component
  }

  tagListComponent() {
    const { data, location, config } = this.props
    const { colorPicker, showSearch, searchText } = this.state
    const activeTags = this.getActiveTags(location.pathname)
    const relatedTags = this.getRelatedTags(activeTags, data.noteMap)
    let tagList = sortBy(
      data.tagNoteMap
        .map((tag, name) => ({
          name,
          size: tag.size,
          related: relatedTags.has(name)
        }))
        .filter(tag => tag.size > 0),
      ['name']
    )
    if (showSearch && searchText.length > 0) {
      tagList = tagList.filter(
        tag => tag.name.toLowerCase().indexOf(searchText.toLowerCase()) !== -1
      )
    }
    if (config.ui.enableLiveNoteCounts && activeTags.length !== 0) {
      const notesTags = data.noteMap.map(note => note.tags)
      tagList = tagList.map(tag => {
        tag.size = notesTags.filter(
          tags => tags.includes(tag.name) && matchActiveTags(tags, activeTags)
        ).length
        return tag
      })
    }
    if (config.sortTagsBy === 'COUNTER') {
      tagList = sortBy(tagList, item => 0 - item.size)
    }
    if (config.ui.showOnlyRelatedTags && relatedTags.size > 0) {
      tagList = tagList.filter(tag => tag.related)
    }
    return tagList.map(tag => {
      return (
        <TagListItem
          name={tag.name}
          handleClickTagListItem={this.handleClickTagListItem.bind(this)}
          handleClickNarrowToTag={this.handleClickNarrowToTag.bind(this)}
          handleContextMenu={this.handleTagContextMenu.bind(this)}
          isActive={
            this.getTagActive(location.pathname, tag.name) ||
            colorPicker.tagName === tag.name
          }
          isRelated={tag.related}
          key={tag.name}
          count={tag.size}
          color={config.coloredTags[tag.name]}
        />
      )
    })
  }

  getRelatedTags(activeTags, noteMap) {
    if (activeTags.length === 0) {
      return new Set()
    }
    const relatedNotes = noteMap
      .map(note => ({ key: note.key, tags: note.tags }))
      .filter(note => activeTags.every(tag => note.tags.includes(tag)))
    const relatedTags = new Set()
    relatedNotes.forEach(note => note.tags.map(tag => relatedTags.add(tag)))
    return relatedTags
  }

  getTagActive(path, tag) {
    return this.getActiveTags(path).includes(tag)
  }

  getActiveTags(path) {
    const pathSegments = path.split('/')
    const tags = pathSegments[pathSegments.length - 1]
    return tags === 'alltags' ? [] : decodeURIComponent(tags).split(' ')
  }

  handleClickTagListItem(name) {
    const { dispatch } = this.props
    dispatch(push(`/tags/${encodeURIComponent(name)}`))
  }

  handleSortTagsByChange(e) {
    const { dispatch } = this.props

    const config = {
      sortTagsBy: e.target.value
    }

    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
  }

  handleClickNarrowToTag(tag) {
    const { dispatch, location } = this.props
    const listOfTags = this.getActiveTags(location.pathname)
    const indexOfTag = listOfTags.indexOf(tag)
    if (indexOfTag > -1) {
      listOfTags.splice(indexOfTag, 1)
    } else {
      listOfTags.push(tag)
    }
    dispatch(push(`/tags/${encodeURIComponent(listOfTags.join(' '))}`))
  }

  emptyTrash(entries) {
    const { dispatch } = this.props
    const deletionPromises = entries.map(note => {
      return dataApi.deleteNote(note.storage, note.key)
    })
    const { confirmDeletion } = this.props.config.ui
    if (!confirmDeleteNote(confirmDeletion, true)) return
    Promise.all(deletionPromises)
      .then(arrayOfStorageAndNoteKeys => {
        arrayOfStorageAndNoteKeys.forEach(({ storageKey, noteKey }) => {
          dispatch({ type: 'DELETE_NOTE', storageKey, noteKey })
        })
      })
      .catch(err => {
        console.error('Cannot Delete note: ' + err)
      })
  }

  handleFilterButtonContextMenu(event) {
    const { data } = this.props
    const trashedNotes = data.trashedSet
      .toJS()
      .map(uniqueKey => data.noteMap.get(uniqueKey))
    context.popup([
      {
        label: i18n.__('Empty Trash'),
        click: () => this.emptyTrash(trashedNotes)
      }
    ])
  }

  render() {
    const { location, config } = this.props
    const { showSearch, searchText, colorPicker: colorPickerState } = this.state

    let colorPicker
    if (colorPickerState.show) {
      colorPicker = (
        <ColorPicker
          color={colorPickerState.color}
          targetRect={colorPickerState.targetRect}
          onConfirm={this.handleColorPickerConfirm}
          onCancel={this.dismissColorPicker}
          onReset={this.handleColorPickerReset}
        />
      )
    }

    const isFolded = config.isSideNavFolded
    const style = {}
    if (!isFolded) style.width = this.props.width
    const isTagActive = /tag/.test(location.pathname)

    const navSearch = (
      <div styleName='search' style={{ maxHeight: showSearch ? '3em' : '0' }}>
        <input
          styleName='search-input'
          type='text'
          onChange={this.handleSearchInputChange}
          value={searchText}
          placeholder={i18n.__('Filter tags/folders...')}
        />
        <img
          styleName='search-clear'
          src='../resources/icon/icon-x.svg'
          onClick={this.handleSearchInputClear}
        />
        {isFolded && (
          <img
            styleName='search-folded'
            src='../resources/icon/icon-search-active.svg'
            onClick={this.handleSearchButtonClick}
          />
        )}
      </div>
    )

    return (
      <div
        className='SideNav'
        styleName={isFolded ? 'root--folded' : 'root'}
        tabIndex='1'
        style={style}
      >
        <div styleName='top'>
          <div styleName='switch-buttons'>
            <ListButton
              onClick={this.handleSwitchFoldersButtonClick.bind(this)}
              isTagActive={isTagActive}
            />
            <TagButton
              onClick={this.handleSwitchTagsButtonClick.bind(this)}
              isTagActive={isTagActive}
            />
          </div>
          <div styleName='extra-buttons'>
            <SearchButton
              onClick={this.handleSearchButtonClick}
              isActive={showSearch}
            />
            <PreferenceButton onClick={this.handleMenuButtonClick} />
          </div>
        </div>
        {navSearch}
        {this.SideNavComponent(isFolded)}
        {colorPicker}
      </div>
    )
  }
}

SideNav.contextTypes = {
  router: PropTypes.shape({})
}

SideNav.propTypes = {
  dispatch: PropTypes.func,
  storages: PropTypes.array,
  config: PropTypes.shape({
    isSideNavFolded: PropTypes.bool
  }),
  location: PropTypes.shape({
    pathname: PropTypes.string
  })
}

export default CSSModules(SideNav, styles)
