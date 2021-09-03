/* global electron */
import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './NoteList.styl'
import moment from 'moment'
import _ from 'lodash'
import ee from 'browser/main/lib/eventEmitter'
import dataApi from 'browser/main/lib/dataApi'
import attachmentManagement from 'browser/main/lib/dataApi/attachmentManagement'
import ConfigManager from 'browser/main/lib/ConfigManager'
import MultipleSelectionDialog from './MultipleSelectionDialog'
import NoteItem from 'browser/components/NoteItem'
import NoteItemSimple from 'browser/components/NoteItemSimple'
import searchFromNotes from 'browser/lib/search'
import fs from 'fs'
import path from 'path'
import { push, replace } from 'connected-react-router'
import copy from 'copy-to-clipboard'
import AwsMobileAnalyticsConfig from 'browser/main/lib/AwsMobileAnalyticsConfig'
import Markdown from '../../lib/markdown'
import i18n from 'browser/lib/i18n'
import { confirmDeleteNote } from 'browser/lib/confirmDeleteNote'
import context from 'browser/lib/context'
import filenamify from 'filenamify'
import queryString from 'query-string'

const { remote } = require('electron')
const { dialog } = remote
const WP_POST_PATH = '/wp/v2/posts'

const regexMatchStartingTitleNumber = new RegExp('^([0-9]*.?[0-9]+).*$')

function sortByCreatedAt(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt)
}

function sortByAlphabetical(a, b) {
  const matchA = regexMatchStartingTitleNumber.exec(a.title)
  const matchB = regexMatchStartingTitleNumber.exec(b.title)

  if (matchA && matchA.length === 2 && matchB && matchB.length === 2) {
    // Both note titles are starting with a float. We will compare it now.
    const floatA = parseFloat(matchA[1])
    const floatB = parseFloat(matchB[1])

    const diff = floatA - floatB
    if (diff !== 0) {
      return diff
    }

    // The float values are equal. We will compare the full title.
  }

  return a.title.localeCompare(b.title)
}

function sortByUpdatedAt(a, b) {
  return new Date(b.updatedAt) - new Date(a.updatedAt)
}

function findNoteByKey(notes, noteKey) {
  return notes.find(note => note.key === noteKey)
}

function findNotesByKeys(notes, noteKeys) {
  return notes.filter(note => noteKeys.includes(getNoteKey(note)))
}

function getNoteKey(note) {
  return note.key
}

class NoteList extends React.Component {
  constructor(props) {
    super(props)

    this.selectNextNoteHandler = () => {
      this.selectNextNote()
    }
    this.selectPriorNoteHandler = () => {
      this.selectPriorNote()
    }
    this.focusHandler = () => {
      this.refs.list.focus()
    }
    this.alertIfSnippetHandler = (event, msg) => {
      this.alertIfSnippet(msg)
    }
    this.importFromFileHandler = this.importFromFile.bind(this)
    this.jumpNoteByHash = this.jumpNoteByHashHandler.bind(this)
    this.handleNoteListKeyUp = this.handleNoteListKeyUp.bind(this)
    this.handleNoteListBlur = this.handleNoteListBlur.bind(this)
    this.getNoteKeyFromTargetIndex = this.getNoteKeyFromTargetIndex.bind(this)
    this.cloneNote = this.cloneNote.bind(this)
    this.deleteNote = this.deleteNote.bind(this)
    this.focusNote = this.focusNote.bind(this)
    this.togglePinToTop = this.togglePinToTop.bind(this) // pin if unpined, unpin if pinned
    this.pinToTop = this.pinToTop.bind(this) // pin all selected
    this.unPin = this.unPin.bind(this) // unpin all selected
    this.star = this.star.bind(this)
    this.unStar = this.unStar.bind(this)
    this.trash = this.trash.bind(this)
    this.permanentlyDelete = this.permanentlyDelete.bind(this)
    this.exportAllSelected = this.exportAllSelected.bind(this)
    this.addTag = this.addTag.bind(this)
    this.removeTag = this.removeTag.bind(this)
    this.getNoteStorage = this.getNoteStorage.bind(this)
    this.getNoteFolder = this.getNoteFolder.bind(this)
    this.getViewType = this.getViewType.bind(this)
    this.restoreNote = this.restoreNote.bind(this)
    this.copyNoteLink = this.copyNoteLink.bind(this)
    this.navigate = this.navigate.bind(this)

    // TODO: not Selected noteKeys but SelectedNote(for reusing)
    this.state = {
      ctrlKeyDown: false,
      shiftKeyDown: false,
      prevShiftNoteIndex: -1,
      selectedNoteKeys: []
    }

    this.contextNotes = []
  }

  componentDidMount() {
    this.refreshTimer = setInterval(() => this.forceUpdate(), 60 * 1000)
    ee.on('list:next', this.selectNextNoteHandler)
    ee.on('list:prior', this.selectPriorNoteHandler)
    ee.on('list:clone', this.cloneNote)
    ee.on('list:focus', this.focusHandler)
    ee.on('list:isMarkdownNote', this.alertIfSnippetHandler)
    ee.on('import:file', this.importFromFileHandler)
    ee.on('list:jump', this.jumpNoteByHash)
    ee.on('list:navigate', this.navigate)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.pathname !== this.props.location.pathname) {
      this.resetScroll()
    }
  }

  resetScroll() {
    this.refs.list.scrollTop = 0
  }

  componentWillUnmount() {
    clearInterval(this.refreshTimer)

    ee.off('list:next', this.selectNextNoteHandler)
    ee.off('list:prior', this.selectPriorNoteHandler)
    ee.off('list:clone', this.cloneNote)
    ee.off('list:focus', this.focusHandler)
    ee.off('list:isMarkdownNote', this.alertIfSnippetHandler)
    ee.off('import:file', this.importFromFileHandler)
    ee.off('list:jump', this.jumpNoteByHash)
  }

  componentDidUpdate(prevProps) {
    const { dispatch, location } = this.props
    const { selectedNoteKeys } = this.state
    const visibleNoteKeys = this.notes && this.notes.map(note => note.key)
    const note = this.notes && this.notes[0]
    const key = location.search && queryString.parse(location.search).key
    const prevKey =
      prevProps.location.search &&
      queryString.parse(prevProps.location.search).key
    const noteKey = visibleNoteKeys.includes(prevKey)
      ? prevKey
      : note && note.key

    if (note && location.search === '') {
      if (!location.pathname.match(/\/searched/))
        this.contextNotes = this.getContextNotes()

      // A visible note is an active note
      if (!selectedNoteKeys.includes(noteKey)) {
        if (selectedNoteKeys.length === 1) selectedNoteKeys.pop()
        selectedNoteKeys.push(noteKey)
        ee.emit('list:moved')
      }

      dispatch(
        replace({
          // was passed with context - we can use connected router here
          pathname: location.pathname,
          search: queryString.stringify({
            key: noteKey
          })
        })
      )
      return
    }

    // Auto scroll
    if (_.isString(key) && prevKey === key) {
      const targetIndex = this.getTargetIndex()
      if (targetIndex > -1) {
        const list = this.refs.list
        const item = list.childNodes[targetIndex]

        if (item == null) return false

        const overflowBelow =
          item.offsetTop +
            item.clientHeight -
            list.clientHeight -
            list.scrollTop >
          0
        if (overflowBelow) {
          list.scrollTop =
            item.offsetTop + item.clientHeight - list.clientHeight
        }
        const overflowAbove = list.scrollTop > item.offsetTop
        if (overflowAbove) {
          list.scrollTop = item.offsetTop
        }
      }
    }
  }

  focusNote(selectedNoteKeys, noteKey, pathname) {
    const { dispatch } = this.props

    this.setState({
      selectedNoteKeys
    })

    dispatch(
      push({
        pathname,
        search: queryString.stringify({
          key: noteKey
        })
      })
    )
  }

  getNoteKeyFromTargetIndex(targetIndex) {
    const note = Object.assign({}, this.notes[targetIndex])
    const noteKey = getNoteKey(note)
    return noteKey
  }

  selectPriorNote() {
    if (this.notes == null || this.notes.length === 0) {
      return
    }
    let { selectedNoteKeys } = this.state
    const { shiftKeyDown } = this.state
    const { location } = this.props

    let targetIndex = this.getTargetIndex()

    if (targetIndex === 0) {
      return
    }
    targetIndex--

    if (!shiftKeyDown) {
      selectedNoteKeys = []
    }
    const priorNoteKey = this.getNoteKeyFromTargetIndex(targetIndex)
    if (selectedNoteKeys.includes(priorNoteKey)) {
      selectedNoteKeys.pop()
    } else {
      selectedNoteKeys.push(priorNoteKey)
    }

    this.focusNote(selectedNoteKeys, priorNoteKey, location.pathname)

    ee.emit('list:moved')
  }

  selectNextNote() {
    if (this.notes == null || this.notes.length === 0) {
      return
    }
    let { selectedNoteKeys } = this.state
    const { shiftKeyDown } = this.state
    const { location } = this.props

    let targetIndex = this.getTargetIndex()
    const isTargetLastNote = targetIndex === this.notes.length - 1

    if (isTargetLastNote && shiftKeyDown) {
      return
    } else if (isTargetLastNote) {
      targetIndex = 0
    } else {
      targetIndex++
      if (targetIndex < 0) targetIndex = 0
      else if (targetIndex > this.notes.length - 1)
        targetIndex = this.notes.length - 1
    }

    if (!shiftKeyDown) {
      selectedNoteKeys = []
    }
    const nextNoteKey = this.getNoteKeyFromTargetIndex(targetIndex)
    if (selectedNoteKeys.includes(nextNoteKey)) {
      selectedNoteKeys.pop()
    } else {
      selectedNoteKeys.push(nextNoteKey)
    }

    this.focusNote(selectedNoteKeys, nextNoteKey, location.pathname)

    ee.emit('list:moved')
  }

  jumpNoteByHashHandler(event, noteHash) {
    const { data } = this.props

    // first argument event isn't used.
    if (this.notes === null || this.notes.length === 0) {
      return
    }

    const selectedNoteKeys = [noteHash]

    let locationToSelect = '/home'
    const noteByHash = data.noteMap
      .map(note => note)
      .find(note => note.key === noteHash)
    if (noteByHash !== undefined) {
      locationToSelect =
        '/storages/' + noteByHash.storage + '/folders/' + noteByHash.folder
    }

    this.focusNote(selectedNoteKeys, noteHash, locationToSelect)

    ee.emit('list:moved')
  }

  handleNoteListKeyDown(e) {
    if (e.metaKey) return true

    // A key
    if (e.keyCode === 65 && !e.shiftKey) {
      e.preventDefault()
      ee.emit('top:new-note')
    }

    // E key
    if (e.keyCode === 69) {
      e.preventDefault()
      ee.emit('detail:focus')
    }

    // L or S key
    if (e.keyCode === 76 || e.keyCode === 83) {
      e.preventDefault()
      ee.emit('top:focus-search')
    }

    // UP or K key
    if (e.keyCode === 38 || e.keyCode === 75) {
      e.preventDefault()
      this.selectPriorNote()
    }

    // DOWN or J key
    if (e.keyCode === 40 || e.keyCode === 74) {
      e.preventDefault()
      this.selectNextNote()
    }

    if (e.shiftKey) {
      this.setState({ shiftKeyDown: true })
    } else if (e.ctrlKey) {
      this.setState({ ctrlKeyDown: true })
    }
  }

  handleNoteListKeyUp(e) {
    if (!e.shiftKey) {
      this.setState({ shiftKeyDown: false })
    }

    if (!e.ctrlKey) {
      this.setState({ ctrlKeyDown: false })
    }
  }

  handleNoteListBlur() {
    this.setState({
      shiftKeyDown: false,
      ctrlKeyDown: false
    })
  }

  getNotes() {
    const {
      data,
      match: { params },
      location
    } = this.props
    if (
      location.pathname.match(/\/home/) ||
      location.pathname.match(/alltags/)
    ) {
      const allNotes = data.noteMap.map(note => note)
      this.contextNotes = allNotes
      return allNotes
    }

    if (location.pathname.match(/\/starred/)) {
      const starredNotes = data.starredSet
        .toJS()
        .map(uniqueKey => data.noteMap.get(uniqueKey))
      this.contextNotes = starredNotes
      return starredNotes
    }

    if (location.pathname.match(/\/searched/)) {
      const searchInputText = params.searchword
      const allNotes = data.noteMap.map(note => note)
      this.contextNotes = allNotes
      if (searchInputText === undefined || searchInputText === '') {
        return this.sortByPin(this.contextNotes)
      }
      return searchFromNotes(this.contextNotes, searchInputText)
    }

    if (location.pathname.match(/\/trashed/)) {
      const trashedNotes = data.trashedSet
        .toJS()
        .map(uniqueKey => data.noteMap.get(uniqueKey))
      this.contextNotes = trashedNotes
      return trashedNotes
    }

    if (location.pathname.match(/\/tags/)) {
      const listOfTags = params.tagname.split(' ')
      return data.noteMap
        .map(note => {
          return note
        })
        .filter(note => listOfTags.every(tag => note.tags.includes(tag)))
    }

    return this.getContextNotes()
  }

  // get notes in the current folder
  getContextNotes() {
    const {
      data,
      match: { params }
    } = this.props
    const storageKey = params.storageKey
    const folderKey = params.folderKey
    const storage = data.storageMap.get(storageKey)
    if (storage === undefined) return []

    const folder = _.find(storage.folders, { key: folderKey })
    if (folder === undefined) {
      const storageNoteSet = data.storageNoteMap.get(storage.key) || []
      return storageNoteSet.map(uniqueKey => data.noteMap.get(uniqueKey))
    }

    const folderNoteKeyList =
      data.folderNoteMap.get(`${storage.key}-${folder.key}`) || []
    return folderNoteKeyList.map(uniqueKey => data.noteMap.get(uniqueKey))
  }

  sortByPin(unorderedNotes) {
    const pinnedNotes = []
    const unpinnedNotes = []

    unorderedNotes.forEach(note => {
      if (note.isPinned) {
        pinnedNotes.push(note)
      } else {
        unpinnedNotes.push(note)
      }
    })

    return pinnedNotes.concat(unpinnedNotes)
  }

  getNoteIndexByKey(noteKey) {
    return this.notes.findIndex(note => {
      if (!note) return -1

      return note.key === noteKey
    })
  }

  handleNoteClick(e, uniqueKey) {
    const { dispatch, location } = this.props
    let { selectedNoteKeys, prevShiftNoteIndex } = this.state
    const { ctrlKeyDown, shiftKeyDown } = this.state
    const hasSelectedNoteKey = selectedNoteKeys.length > 0

    if (ctrlKeyDown && selectedNoteKeys.includes(uniqueKey)) {
      const newSelectedNoteKeys = selectedNoteKeys.filter(
        noteKey => noteKey !== uniqueKey
      )
      this.setState({
        selectedNoteKeys: newSelectedNoteKeys
      })
      return
    }
    if (!ctrlKeyDown && !shiftKeyDown) {
      selectedNoteKeys = []
    }

    if (!shiftKeyDown) {
      prevShiftNoteIndex = -1
    }

    selectedNoteKeys.push(uniqueKey)

    if (shiftKeyDown && hasSelectedNoteKey) {
      let firstShiftNoteIndex = this.getNoteIndexByKey(selectedNoteKeys[0])
      // Shift selection can either start from first note in the exisiting selectedNoteKeys
      // or previous first shift note index
      firstShiftNoteIndex =
        firstShiftNoteIndex > prevShiftNoteIndex
          ? firstShiftNoteIndex
          : prevShiftNoteIndex

      const lastShiftNoteIndex = this.getNoteIndexByKey(uniqueKey)

      const startIndex =
        firstShiftNoteIndex < lastShiftNoteIndex
          ? firstShiftNoteIndex
          : lastShiftNoteIndex
      const endIndex =
        firstShiftNoteIndex > lastShiftNoteIndex
          ? firstShiftNoteIndex
          : lastShiftNoteIndex

      selectedNoteKeys = []
      for (let i = startIndex; i <= endIndex; i++) {
        selectedNoteKeys.push(this.notes[i].key)
      }

      if (prevShiftNoteIndex < 0) {
        prevShiftNoteIndex = firstShiftNoteIndex
      }
    }

    this.setState({
      selectedNoteKeys,
      prevShiftNoteIndex
    })

    dispatch(
      push({
        pathname: location.pathname,
        search: queryString.stringify({
          key: uniqueKey
        })
      })
    )
  }

  handleSortByChange(e) {
    const {
      dispatch,
      match: {
        params: { folderKey }
      }
    } = this.props

    const config = {
      [folderKey]: { sortBy: e.target.value }
    }

    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
  }

  handleListStyleButtonClick(e, style) {
    const { dispatch } = this.props

    const config = {
      listStyle: style
    }

    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
  }

  handleListDirectionButtonClick(e, direction) {
    const { dispatch } = this.props

    const config = {
      listDirection: direction
    }

    ConfigManager.set(config)
    dispatch({
      type: 'SET_CONFIG',
      config
    })
  }

  alertIfSnippet(msg) {
    const warningMessage = msg =>
      ({
        'export-txt': 'Text export',
        'export-md': 'Markdown export',
        'export-html': 'HTML export',
        'export-pdf': 'PDF export',
        print: 'Print'
      }[msg])

    const targetIndex = this.getTargetIndex()
    if (this.notes[targetIndex].type === 'SNIPPET_NOTE') {
      dialog.showMessageBox(remote.getCurrentWindow(), {
        type: 'warning',
        message: i18n.__('Sorry!'),
        detail: i18n.__(
          warningMessage(msg) + ' is available only in markdown notes.'
        ),
        buttons: [i18n.__('OK')]
      })
    }
  }

  handleDragStart(e, note) {
    let { selectedNoteKeys } = this.state
    const noteKey = getNoteKey(note)

    if (!selectedNoteKeys.includes(noteKey)) {
      selectedNoteKeys = []
      selectedNoteKeys.push(noteKey)
    }

    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const noteData = JSON.stringify(selectedNotes)
    e.dataTransfer.setData('note', noteData)
    this.selectNextNote()
  }

  handleExportClick(e, note, fileType) {
    const options = {
      defaultPath: filenamify(note.title, {
        replacement: '_'
      }),
      filters: [{ name: 'Documents', extensions: [fileType] }],
      properties: ['openFile', 'createDirectory']
    }

    dialog.showSaveDialog(remote.getCurrentWindow(), options, filename => {
      if (filename) {
        const { config } = this.props

        dataApi
          .exportNoteAs(note, filename, fileType, config)
          .then(res => {
            dialog.showMessageBox(remote.getCurrentWindow(), {
              type: 'info',
              message: `Exported to ${filename}`
            })
          })
          .catch(err => {
            dialog.showErrorBox(
              'Export error',
              err ? err.message || err : 'Unexpected error during export'
            )
            throw err
          })
      }
    })
  }

  exportAllSelected(e, fileType) {
    // Select directory
    // trying export all notes one by one
    // if a file already exists, ask resolution method [replace, replace all, skip, skip all, quit]
    // replace all: replace all conflicting files
    // skip all: skip all conflicting files
    const options = {
      title: i18n.__('Select folder for the exports'),
      properties: ['openDirectory', 'createDirectory']
    }

    // Find the target folder
    dialog.showOpenDialog(remote.getCurrentWindow(), options, folderPaths => {
      if (folderPaths) {
        // To show succesful and un-succesful attempts
        let replaceAll = false
        let skipAll = false

        // Export each note one by one
        const folderPath = folderPaths[0]
        const { selectedNoteKeys } = this.state
        selectedNoteKeys.every(noteKey => {
          // Find the name
          const note = findNoteByKey(this.notes, noteKey)
          // generate full path and add extensions to
          const filename =
            filenamify(note.title, { replacement: '_' }) + `.${fileType}`
          const filepath = path.join(folderPath, filename)

          if (fs.existsSync(filepath)) {
            if (skipAll) {
              return
            } else if (replaceAll) {
              // pass through, file will be over-written
            } else {
              const options = {
                buttons: [
                  // if you change the order, change switch(response) too
                  i18n.__('Replace'),
                  i18n.__('Replace All'),
                  i18n.__('Skip'),
                  i18n.__('Skip All'),
                  i18n.__('Abort')
                ],
                message: `${filename} ${i18n.__(
                  'already exists in selected folder.'
                )}`
              }
              const response = dialog.showMessageBox(
                remote.getCurrentWindow(),
                options
              )
              switch (response) {
                case 0:
                  // do nothing file will be over-written
                  break
                case 1:
                  replaceAll = true
                  break
                case 2:
                  return true // return to skip to next item in mapped array
                case 3:
                  skipAll = true
                  return true
                case 4:
                  return false // break out of for each
              }
            }
          }

          const { config } = this.props
          dataApi
            .exportNoteAs(note, filepath, fileType, config)
            .then(res => {
              console.log(
                `${filepath} ${i18n.__('was exported successsfully')}`
              )
            })
            .catch(err => {
              console.log(
                `${i18n.__('Error while expoting')} ${filepath} : ${
                  err ? err.message || err : 'Unexpected error during export'
                }`
              )
            })
          return true
        })
      }
    })
  }

  handleNoteContextMenu(e, uniqueKey) {
    const { location } = this.props
    const { selectedNoteKeys } = this.state
    const note = findNoteByKey(this.notes, uniqueKey)
    const noteKey = getNoteKey(note)

    if (selectedNoteKeys.length === 0 || !selectedNoteKeys.includes(noteKey)) {
      this.handleNoteClick(e, uniqueKey)
    }

    const pinLabel = note.isPinned
      ? i18n.__('Remove pin')
      : i18n.__('Pin to Top')
    const deleteLabel = i18n.__('Delete Note')
    const cloneNote = i18n.__('Clone Note')
    const restoreNote = i18n.__('Restore Note')
    const copyNoteLink = i18n.__('Copy Note Link')
    const publishLabel = i18n.__('Publish Blog')
    const updateLabel = i18n.__('Update Blog')
    const openBlogLabel = i18n.__('Open Blog')

    const templates = []

    if (location.pathname.match(/\/trash/)) {
      templates.push(
        {
          label: restoreNote,
          click: this.restoreNote
        },
        {
          label: deleteLabel,
          click: this.deleteNote
        }
      )
    } else {
      if (!location.pathname.match(/\/starred/)) {
        templates.push({
          label: pinLabel,
          click: this.togglePinToTop
        })
      }
      templates.push(
        {
          label: deleteLabel,
          click: this.deleteNote
        },
        {
          label: cloneNote,
          click: this.cloneNote.bind(this)
        },
        {
          label: copyNoteLink,
          click: this.copyNoteLink.bind(this, note)
        }
      )

      if (note.type === 'MARKDOWN_NOTE') {
        templates.push(
          {
            type: 'separator'
          },
          {
            label: i18n.__('Export Note'),
            submenu: [
              {
                label: i18n.__('Export as Plain Text (.txt)'),
                click: e => this.handleExportClick(e, note, 'txt')
              },
              {
                label: i18n.__('Export as Markdown (.md)'),
                click: e => this.handleExportClick(e, note, 'md')
              },
              {
                label: i18n.__('Export as HTML (.html)'),
                click: e => this.handleExportClick(e, note, 'html')
              },
              {
                label: i18n.__('Export as PDF (.pdf)'),
                click: e => this.handleExportClick(e, note, 'pdf')
              }
            ]
          }
        )

        if (note.blog && note.blog.blogLink && note.blog.blogId) {
          templates.push(
            {
              type: 'separator'
            },
            {
              label: updateLabel,
              click: this.publishMarkdown.bind(this)
            },
            {
              label: openBlogLabel,
              click: () => this.openBlog.bind(this)(note)
            }
          )
        } else {
          templates.push(
            {
              type: 'separator'
            },
            {
              label: publishLabel,
              click: this.publishMarkdown.bind(this)
            }
          )
        }
      }
    }
    context.popup(templates)
  }

  updateSelectedNotes(updateFunc, cleanSelection = true) {
    const { selectedNoteKeys } = this.state
    const { dispatch } = this.props
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)

    if (!_.isFunction(updateFunc)) {
      console.warn('Update function is not defined. No update will happen')
      updateFunc = note => {
        return note
      }
    }

    Promise.all(
      selectedNotes.map(note => {
        note = updateFunc(note)
        return dataApi.updateNote(note.storage, note.key, note)
      })
    ).then(updatedNotes => {
      updatedNotes.forEach(note => {
        dispatch({
          type: 'UPDATE_NOTE',
          note
        })
      })
    })

    if (cleanSelection) {
      this.selectNextNote()
    }
  }

  togglePinToTop() {
    this.updateSelectedNotes(note => {
      note.isPinned = !note.isPinned
      return note
    })
  }

  pinToTop() {
    this.updateSelectedNotes(note => {
      note.isPinned = true
      return note
    })
  }

  unPin() {
    this.updateSelectedNotes(note => {
      note.isPinned = false
      return note
    })
  }

  star() {
    this.updateSelectedNotes(note => {
      note.isStarred = true
      return note
    })
  }

  unStar() {
    this.updateSelectedNotes(note => {
      note.isStarred = false
      return note
    })
  }

  addTag(newTag) {
    newTag = newTag.trim().replace(/ +/g, '_')
    if (newTag.charAt(0) === '#') {
      newTag.substring(1)
    }

    if (newTag.length <= 0) {
      return
    }

    this.updateSelectedNotes(note => {
      note.tags = _.isArray(note.tags) ? note.tags.slice() : []

      if (!_.includes(note.tags, newTag)) {
        note.tags.push(newTag)
      }
      return note
    })
  }

  removeTag(tagname) {
    this.updateSelectedNotes(note => {
      note.tags = _.isArray(note.tags) ? note.tags.slice() : []
      note.tags.splice(note.tags.indexOf(tagname), 1)
      return note
    })
  }

  trash() {
    const { dispatch } = this.props
    const { selectedNoteKeys } = this.state
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const { confirmDeletion } = this.props.config.ui

    if (!confirmDeleteNote(confirmDeletion, false)) return

    Promise.all(
      selectedNotes.map(note => {
        note.isTrashed = true

        return dataApi.updateNote(note.storage, note.key, note)
      })
    )
      .then(newNotes => {
        newNotes.forEach(newNote => {
          dispatch({
            type: 'UPDATE_NOTE',
            note: newNote
          })
        })
        AwsMobileAnalyticsConfig.recordDynamicCustomEvent('EDIT_NOTE')
      })
      .then(() => ee.emit('list:next'))
      .catch(err => {
        console.error('Notes could not go to trash: ' + err)
      })
    this.setState({ selectedNoteKeys: [] })
  }

  permanentlyDelete() {
    const { dispatch } = this.props
    const { selectedNoteKeys } = this.state
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const { confirmDeletion } = this.props.config.ui

    if (!confirmDeleteNote(confirmDeletion, true)) return

    Promise.all(
      selectedNotes.map(note => {
        return dataApi.deleteNote(note.storage, note.key)
      })
    )
      .then(data => {
        const dispatchHandler = () => {
          data.forEach(item => {
            dispatch({
              type: 'DELETE_NOTE',
              storageKey: item.storageKey,
              noteKey: item.noteKey
            })
          })
        }
        ee.once('list:next', dispatchHandler)
      })
      .then(() => ee.emit('list:next'))
      .catch(err => {
        console.error('Cannot Delete note: ' + err)
      })
    this.setState({ selectedNoteKeys: [] })
  }

  restoreNote() {
    this.updateSelectedNotes(note => {
      note.isTrashed = false
      return note
    })
  }

  deleteNote() {
    const { selectedNoteKeys } = this.state
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const firstNote = selectedNotes[0]

    if (firstNote.isTrashed) {
      this.permanentlyDelete()
    } else {
      this.trash()
    }
  }

  cloneNote() {
    const { selectedNoteKeys } = this.state
    const { dispatch, location } = this.props
    const { storage, folder } = this.resolveTargetFolder()
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const firstNote = selectedNotes[0]
    const eventName =
      firstNote.type === 'MARKDOWN_NOTE' ? 'ADD_MARKDOWN' : 'ADD_SNIPPET'

    AwsMobileAnalyticsConfig.recordDynamicCustomEvent(eventName)
    AwsMobileAnalyticsConfig.recordDynamicCustomEvent('ADD_ALLNOTE')
    dataApi
      .createNote(storage.key, {
        type: firstNote.type,
        folder: folder.key,
        title: firstNote.title + ' ' + i18n.__('copy'),
        content: firstNote.content,
        linesHighlighted: firstNote.linesHighlighted,
        description: firstNote.description,
        snippets: firstNote.snippets,
        tags: firstNote.tags,
        isStarred: firstNote.isStarred
      })
      .then(note => {
        attachmentManagement.cloneAttachments(firstNote, note)
        return note
      })
      .then(note => {
        dispatch({
          type: 'UPDATE_NOTE',
          note: note
        })

        this.setState({
          selectedNoteKeys: [note.key]
        })

        dispatch(
          push({
            pathname: location.pathname,
            search: queryString.stringify({ key: note.key })
          })
        )
      })
  }

  copyNoteLink(note) {
    const noteLink = `[${note.title}](:note:${note.key})`
    return copy(noteLink)
  }

  navigate(sender, pathname) {
    const { dispatch } = this.props
    dispatch(
      push({
        pathname,
        search: queryString.stringify({
          // key: noteKey
        })
      })
    )
  }

  save(note) {
    const { dispatch } = this.props
    dataApi.updateNote(note.storage, note.key, note).then(note => {
      dispatch({
        type: 'UPDATE_NOTE',
        note: note
      })
    })
  }

  publishMarkdown() {
    if (this.pendingPublish) {
      clearTimeout(this.pendingPublish)
    }
    this.pendingPublish = setTimeout(() => {
      this.publishMarkdownNow()
    }, 1000)
  }

  publishMarkdownNow() {
    const { selectedNoteKeys } = this.state
    const notes = this.notes.map(note => Object.assign({}, note))
    const selectedNotes = findNotesByKeys(notes, selectedNoteKeys)
    const firstNote = selectedNotes[0]
    const config = ConfigManager.get()
    const { address, token, authMethod, username, password } = config.blog
    let authToken = ''
    if (authMethod === 'USER') {
      authToken = `Basic ${window.btoa(`${username}:${password}`)}`
    } else {
      authToken = `Bearer ${token}`
    }
    const contentToRender = firstNote.content.replace(
      `# ${firstNote.title}`,
      ''
    )
    const markdown = new Markdown()
    const data = {
      title: firstNote.title,
      content: markdown.render(contentToRender),
      status: 'publish'
    }

    let url = ''
    let method = ''
    if (firstNote.blog && firstNote.blog.blogId) {
      url = `${address}${WP_POST_PATH}/${firstNote.blog.blogId}`
      method = 'PUT'
    } else {
      url = `${address}${WP_POST_PATH}`
      method = 'POST'
    }
    // eslint-disable-next-line no-undef
    fetch(url, {
      method: method,
      body: JSON.stringify(data),
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(response => {
        if (_.isNil(response.link) || _.isNil(response.id)) {
          return Promise.reject()
        }
        firstNote.blog = {
          blogLink: response.link,
          blogId: response.id
        }
        this.save(firstNote)
        this.confirmPublish(firstNote)
      })
      .catch(error => {
        console.error(error)
        this.confirmPublishError()
      })
  }

  confirmPublishError() {
    const { remote } = electron
    const { dialog } = remote
    const alertError = {
      type: 'warning',
      message: i18n.__('Publish Failed'),
      detail: i18n.__('Check and update your blog setting and try again.'),
      buttons: [i18n.__('Confirm')]
    }
    dialog.showMessageBox(remote.getCurrentWindow(), alertError)
  }

  confirmPublish(note) {
    const buttonIndex = dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: i18n.__('Publish Succeeded'),
      detail: `${note.title} is published at ${note.blog.blogLink}`,
      buttons: [i18n.__('Confirm'), i18n.__('Open Blog')]
    })

    if (buttonIndex === 1) {
      this.openBlog(note)
    }
  }

  openBlog(note) {
    const { shell } = electron
    shell.openExternal(note.blog.blogLink)
  }

  importFromFile() {
    const options = {
      filters: [{ name: 'Documents', extensions: ['md', 'txt'] }],
      properties: ['openFile', 'multiSelections']
    }

    dialog.showOpenDialog(remote.getCurrentWindow(), options, filepaths => {
      this.addNotesFromFiles(filepaths)
    })
  }

  handleDrop(e) {
    e.preventDefault()
    const { location } = this.props
    const filepaths = Array.from(e.dataTransfer.files).map(file => {
      return file.path
    })
    if (!location.pathname.match(/\/trashed/)) this.addNotesFromFiles(filepaths)
  }

  // Add notes to the current folder
  addNotesFromFiles(filepaths) {
    const { dispatch, location } = this.props
    const { storage, folder } = this.resolveTargetFolder()

    if (filepaths === undefined) return
    filepaths.forEach(filepath => {
      fs.readFile(filepath, (err, data) => {
        if (err) throw Error('File reading error: ', err)

        fs.stat(filepath, (err, { mtime, birthtime }) => {
          if (err) throw Error('File stat reading error: ', err)

          const content = data.toString()
          const newNote = {
            content: content,
            folder: folder.key,
            title: path.basename(filepath, path.extname(filepath)),
            type: 'MARKDOWN_NOTE',
            createdAt: birthtime,
            updatedAt: mtime
          }
          dataApi.createNote(storage.key, newNote).then(note => {
            attachmentManagement
              .importAttachments(note.content, filepath, storage.key, note.key)
              .then(newcontent => {
                note.content = newcontent

                dataApi.updateNote(storage.key, note.key, note)

                dispatch({
                  type: 'UPDATE_NOTE',
                  note: note
                })
                dispatch(
                  push({
                    pathname: location.pathname,
                    search: queryString.stringify({ key: getNoteKey(note) })
                  })
                )
              })
          })
        })
      })
    })
  }

  getTargetIndex() {
    const { location } = this.props
    const key = queryString.parse(location.search).key
    const targetIndex = _.findIndex(this.notes, note => {
      return getNoteKey(note) === key
    })
    return targetIndex
  }

  resolveTargetFolder() {
    const {
      data,
      match: { params }
    } = this.props
    let storage = data.storageMap.get(params.storageKey)

    // Find first storage
    if (storage == null) {
      for (const kv of data.storageMap) {
        storage = kv[1]
        break
      }
    }

    if (storage == null) this.showMessageBox('No storage for importing note(s)')
    const folder =
      _.find(storage.folders, { key: params.folderKey }) || storage.folders[0]
    if (folder == null) this.showMessageBox('No folder for importing note(s)')

    return {
      storage,
      folder
    }
  }

  showMessageBox(message) {
    dialog.showMessageBox(remote.getCurrentWindow(), {
      type: 'warning',
      message: message,
      buttons: [i18n.__('OK')]
    })
  }

  getNoteStorage(note) {
    // note.storage = storage key
    return this.props.data.storageMap.toJS()[note.storage]
  }

  getNoteFolder(note) {
    // note.folder = folder key
    const storage = this.getNoteStorage(note)
    return storage
      ? _.find(storage.folders, ({ key }) => key === note.folder)
      : []
  }

  getViewType() {
    const { pathname } = this.props.location
    const folder = /\/folders\/[a-zA-Z0-9]+/.test(pathname)
    const storage = /\/storages\/[a-zA-Z0-9]+/.test(pathname) && !folder
    const allNotes = pathname === '/home'
    if (allNotes) return 'ALL'
    if (folder) return 'FOLDER'
    if (storage) return 'STORAGE'
  }

  render() {
    const {
      location,
      config,
      match: {
        params: { folderKey }
      }
    } = this.props
    let { notes } = this.props
    const { selectedNoteKeys } = this.state
    const sortBy = _.get(config, [folderKey, 'sortBy'], config.sortBy.default)
    const sortDir = config.listDirection
    const sortFunc =
      sortBy === 'CREATED_AT'
        ? sortByCreatedAt
        : sortBy === 'ALPHABETICAL'
        ? sortByAlphabetical
        : sortByUpdatedAt
    const sortedNotes = location.pathname.match(/\/starred|\/trash/)
      ? this.getNotes().sort(sortFunc)
      : this.sortByPin(this.getNotes().sort(sortFunc))
    this.notes = notes = sortedNotes.filter(note => {
      if (
        // has matching storage
        !!this.getNoteStorage(note) &&
        // this is for the trash box
        (note.isTrashed !== true || location.pathname === '/trashed')
      ) {
        return true
      }
    })
    if (sortDir === 'DESCENDING') this.notes.reverse()

    moment.updateLocale('en', {
      relativeTime: {
        future: 'in %s',
        past: '%s ago',
        s: '%ds',
        ss: '%ss',
        m: '1m',
        mm: '%dm',
        h: 'an hour',
        hh: '%dh',
        d: '1d',
        dd: '%dd',
        M: '1M',
        MM: '%dM',
        y: '1Y',
        yy: '%dY'
      }
    })

    const viewType = this.getViewType()

    const autoSelectFirst =
      notes.length === 1 ||
      selectedNoteKeys.length === 0 ||
      notes.every(note => !selectedNoteKeys.includes(note.key))

    const noteList = notes.map((note, index) => {
      if (note == null) {
        return null
      }

      const isDefault = config.listStyle === 'DEFAULT'
      const uniqueKey = getNoteKey(note)

      const isActive =
        selectedNoteKeys.includes(uniqueKey) ||
        notes.length === 1 ||
        (autoSelectFirst && index === 0)
      const dateDisplay = moment(
        sortBy === 'CREATED_AT' ? note.createdAt : note.updatedAt
      ).fromNow('D')

      const storage = this.getNoteStorage(note)

      if (isDefault) {
        return (
          <NoteItem
            isActive={isActive}
            note={note}
            dateDisplay={dateDisplay}
            key={uniqueKey}
            handleNoteContextMenu={this.handleNoteContextMenu.bind(this)}
            handleNoteClick={this.handleNoteClick.bind(this)}
            handleDragStart={this.handleDragStart.bind(this)}
            pathname={location.pathname}
            folderName={this.getNoteFolder(note).name}
            storageName={storage.name}
            viewType={viewType}
            showTagsAlphabetically={config.ui.showTagsAlphabetically}
            coloredTags={config.coloredTags}
          />
        )
      }

      return (
        <NoteItemSimple
          isActive={isActive}
          note={note}
          key={uniqueKey}
          handleNoteContextMenu={this.handleNoteContextMenu.bind(this)}
          handleNoteClick={this.handleNoteClick.bind(this)}
          handleDragStart={this.handleDragStart.bind(this)}
          pathname={location.pathname}
          folderName={this.getNoteFolder(note).name}
          storageName={storage.name}
          viewType={viewType}
        />
      )
    })

    return (
      <div
        className='NoteList'
        styleName='root'
        style={this.props.style}
        onDrop={e => this.handleDrop(e)}
      >
        <div styleName='control'>
          <div styleName='control-sortBy'>
            <i className='fa fa-angle-down' />
            <select
              styleName='control-sortBy-select'
              title={i18n.__('Select filter mode')}
              value={sortBy}
              onChange={e => this.handleSortByChange(e)}
            >
              <option title='Sort by update time' value='UPDATED_AT'>
                {i18n.__('Updated')}
              </option>
              <option title='Sort by create time' value='CREATED_AT'>
                {i18n.__('Created')}
              </option>
              <option title='Sort alphabetically' value='ALPHABETICAL'>
                {i18n.__('Alphabetically')}
              </option>
            </select>
          </div>
          <div styleName='control-button-area'>
            <button
              title={i18n.__('Ascending Order')}
              styleName={
                config.listDirection === 'ASCENDING'
                  ? 'control-button--active'
                  : 'control-button'
              }
              onClick={e => this.handleListDirectionButtonClick(e, 'ASCENDING')}
            >
              <img src='../resources/icon/icon-up.svg' />
            </button>
            <button
              title={i18n.__('Descending Order')}
              styleName={
                config.listDirection === 'DESCENDING'
                  ? 'control-button--active'
                  : 'control-button'
              }
              onClick={e =>
                this.handleListDirectionButtonClick(e, 'DESCENDING')
              }
            >
              <img src='../resources/icon/icon-down.svg' />
            </button>
            <button
              title={i18n.__('Default View')}
              styleName={
                config.listStyle === 'DEFAULT'
                  ? 'control-button--active'
                  : 'control-button'
              }
              onClick={e => this.handleListStyleButtonClick(e, 'DEFAULT')}
            >
              <img src='../resources/icon/icon-column.svg' />
            </button>
            <button
              title={i18n.__('Compressed View')}
              styleName={
                config.listStyle === 'SMALL'
                  ? 'control-button--active'
                  : 'control-button'
              }
              onClick={e => this.handleListStyleButtonClick(e, 'SMALL')}
            >
              <img src='../resources/icon/icon-column-list.svg' />
            </button>
          </div>
        </div>
        <div
          styleName='list'
          ref='list'
          tabIndex='-1'
          onKeyDown={e => this.handleNoteListKeyDown(e)}
          onKeyUp={this.handleNoteListKeyUp}
          onBlur={this.handleNoteListBlur}
        >
          {noteList}
        </div>
        <MultipleSelectionDialog
          nSelectedNotes={selectedNoteKeys.length}
          addTag={this.addTag}
          removeTag={this.removeTag}
          onPin={this.pinToTop}
          onUnPin={this.unPin}
          onStar={this.star}
          onUnStar={this.unStar}
          onTrash={this.trash}
          onDelete={this.permanentlyDelete}
          onExport={this.exportAllSelected}
          onPublish={this.publishMarkdown.bind(this)}
        />
      </div>
    )
  }
}
NoteList.contextTypes = {
  router: PropTypes.shape([])
}

NoteList.propTypes = {
  dispatch: PropTypes.func,
  repositories: PropTypes.array,
  style: PropTypes.shape({
    width: PropTypes.number
  })
}

export default CSSModules(NoteList, styles)
