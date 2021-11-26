import { combineReducers, createStore, compose, applyMiddleware } from 'redux'
import { connectRouter, routerMiddleware } from 'connected-react-router'
import { createHashHistory as createHistory } from 'history'
import ConfigManager from 'browser/main/lib/ConfigManager'
import { Map, Set } from 'browser/lib/Mutable'
import _ from 'lodash'
import DevTools from './DevTools'

function defaultDataMap() {
  return {
    storageMap: new Map(),
    noteMap: new Map(),
    starredSet: new Set(),
    storageNoteMap: new Map(),
    folderNoteMap: new Map(),
    tagNoteMap: new Map(),
    trashedSet: new Set()
  }
}

function data(state = defaultDataMap(), action) {
  switch (action.type) {
    case 'INIT_ALL':
      state = defaultDataMap()

      action.storages.forEach(storage => {
        state.storageMap.set(storage.key, storage)
      })

      action.notes.some(note => {
        if (note === undefined) return true
        const uniqueKey = note.key
        const folderKey = note.storage + '-' + note.folder
        state.noteMap.set(uniqueKey, note)

        if (note.isStarred) {
          state.starredSet.add(uniqueKey)
        }

        if (note.isTrashed) {
          state.trashedSet.add(uniqueKey)
        }
        const storageNoteList = getOrInitItem(
          state.storageNoteMap,
          note.storage
        )
        storageNoteList.add(uniqueKey)

        const folderNoteSet = getOrInitItem(state.folderNoteMap, folderKey)
        folderNoteSet.add(uniqueKey)

        if (!note.isTrashed) {
          assignToTags(note.tags, state, uniqueKey)
        }
      })
      return state
    case 'UPDATE_NOTE': {
      const note = action.note
      const uniqueKey = note.key
      const folderKey = note.storage + '-' + note.folder
      const oldNote = state.noteMap.get(uniqueKey)

      state = Object.assign({}, state)
      state.noteMap = new Map(state.noteMap)
      state.noteMap.set(uniqueKey, note)

      updateStarredChange(oldNote, note, state, uniqueKey)

      if (oldNote == null || oldNote.isTrashed !== note.isTrashed) {
        state.trashedSet = new Set(state.trashedSet)
        if (note.isTrashed) {
          state.trashedSet.add(uniqueKey)
          state.starredSet.delete(uniqueKey)
          removeFromTags(note.tags, state, uniqueKey)
        } else {
          state.trashedSet.delete(uniqueKey)

          assignToTags(note.tags, state, uniqueKey)

          if (note.isStarred) {
            state.starredSet.add(uniqueKey)
          }
        }
      }

      // Update storageNoteMap if oldNote doesn't exist
      if (oldNote == null) {
        state.storageNoteMap = new Map(state.storageNoteMap)
        let storageNoteSet = state.storageNoteMap.get(note.storage)
        storageNoteSet = new Set(storageNoteSet)
        storageNoteSet.add(uniqueKey)
        state.storageNoteMap.set(note.storage, storageNoteSet)
      }

      // Update foldermap if folder changed or post created
      updateFolderChange(oldNote, note, state, folderKey, uniqueKey)

      if (oldNote != null) {
        updateTagChanges(oldNote, note, state, uniqueKey)
      } else {
        assignToTags(note.tags, state, uniqueKey)
      }

      return state
    }
    case 'MOVE_NOTE': {
      const originNote = action.originNote
      const originKey = originNote.key
      const note = action.note
      const uniqueKey = note.key
      const folderKey = note.storage + '-' + note.folder
      const oldNote = state.noteMap.get(uniqueKey)

      state = Object.assign({}, state)
      state.noteMap = new Map(state.noteMap)
      state.noteMap.delete(originKey)
      state.noteMap.set(uniqueKey, note)

      // If storage chanced, origin key must be discarded
      if (originKey !== uniqueKey) {
        // From isStarred
        if (originNote.isStarred) {
          state.starredSet = new Set(state.starredSet)
          state.starredSet.delete(originKey)
        }

        if (originNote.isTrashed) {
          state.trashedSet = new Set(state.trashedSet)
          state.trashedSet.delete(originKey)
        }

        // From storageNoteMap
        state.storageNoteMap = new Map(state.storageNoteMap)
        let noteSet = state.storageNoteMap.get(originNote.storage)
        noteSet = new Set(noteSet)
        noteSet.delete(originKey)
        state.storageNoteMap.set(originNote.storage, noteSet)

        // From folderNoteMap
        state.folderNoteMap = new Map(state.folderNoteMap)
        const originFolderKey = originNote.storage + '-' + originNote.folder
        let originFolderList = state.folderNoteMap.get(originFolderKey)
        originFolderList = new Set(originFolderList)
        originFolderList.delete(originKey)
        state.folderNoteMap.set(originFolderKey, originFolderList)

        removeFromTags(originNote.tags, state, originKey)
      }

      updateStarredChange(oldNote, note, state, uniqueKey)

      if (oldNote == null || oldNote.isTrashed !== note.isTrashed) {
        state.trashedSet = new Set(state.trashedSet)
        if (note.isTrashed) {
          state.trashedSet.add(uniqueKey)
        } else {
          state.trashedSet.delete(uniqueKey)
        }
      }

      // Update storageNoteMap if oldNote doesn't exist
      if (oldNote == null) {
        state.storageNoteMap = new Map(state.storageNoteMap)
        let noteSet = state.storageNoteMap.get(note.storage)
        noteSet = new Set(noteSet)
        noteSet.add(uniqueKey)
        state.storageNoteMap.set(folderKey, noteSet)
      }

      // Update foldermap if folder changed or post created
      updateFolderChange(oldNote, note, state, folderKey, uniqueKey)

      // Remove from old folder map
      if (oldNote != null) {
        updateTagChanges(oldNote, note, state, uniqueKey)
      } else {
        assignToTags(note.tags, state, uniqueKey)
      }

      return state
    }
    case 'DELETE_NOTE': {
      const uniqueKey = action.noteKey
      const targetNote = state.noteMap.get(uniqueKey)

      state = Object.assign({}, state)

      // From storageNoteMap
      state.storageNoteMap = new Map(state.storageNoteMap)
      let noteSet = state.storageNoteMap.get(targetNote.storage)
      noteSet = new Set(noteSet)
      noteSet.delete(uniqueKey)
      state.storageNoteMap.set(targetNote.storage, noteSet)

      if (targetNote != null) {
        // From isStarred
        if (targetNote.isStarred) {
          state.starredSet = new Set(state.starredSet)
          state.starredSet.delete(uniqueKey)
        }

        if (targetNote.isTrashed) {
          state.trashedSet = new Set(state.trashedSet)
          state.trashedSet.delete(uniqueKey)
        }

        // From folderNoteMap
        const folderKey = targetNote.storage + '-' + targetNote.folder
        state.folderNoteMap = new Map(state.folderNoteMap)
        let folderSet = state.folderNoteMap.get(folderKey)
        folderSet = new Set(folderSet)
        folderSet.delete(uniqueKey)
        state.folderNoteMap.set(folderKey, folderSet)

        removeFromTags(targetNote.tags, state, uniqueKey)
      }
      state.noteMap = new Map(state.noteMap)
      state.noteMap.delete(uniqueKey)
      return state
    }
    case 'UPDATE_FOLDER':
    case 'REORDER_FOLDER':
    case 'EXPORT_FOLDER':
    case 'RENAME_STORAGE':
    case 'EXPORT_STORAGE':
      state = Object.assign({}, state)
      state.storageMap = new Map(state.storageMap)
      state.storageMap.set(action.storage.key, action.storage)
      return state
    case 'DELETE_FOLDER':
      {
        state = Object.assign({}, state)
        state.storageMap = new Map(state.storageMap)
        state.storageMap.set(action.storage.key, action.storage)

        // Get note list from folder-note map
        // and delete note set from folder-note map
        const folderKey = action.storage.key + '-' + action.folderKey
        const noteSet = state.folderNoteMap.get(folderKey)
        state.folderNoteMap = new Map(state.folderNoteMap)
        state.folderNoteMap.delete(folderKey)

        state.noteMap = new Map(state.noteMap)
        state.storageNoteMap = new Map(state.storageNoteMap)
        let storageNoteSet = state.storageNoteMap.get(action.storage.key)
        storageNoteSet = new Set(storageNoteSet)
        state.storageNoteMap.set(action.storage.key, storageNoteSet)

        if (noteSet != null) {
          noteSet.forEach(function handleNoteKey(noteKey) {
            // Get note from noteMap
            const note = state.noteMap.get(noteKey)
            if (note != null) {
              state.noteMap.delete(noteKey)

              // From storageSet
              storageNoteSet.delete(noteKey)

              // From starredSet
              if (note.isStarred) {
                state.starredSet = new Set(state.starredSet)
                state.starredSet.delete(noteKey)
              }

              if (note.isTrashed) {
                state.trashedSet = new Set(state.trashedSet)
                state.trashedSet.delete(noteKey)
              }

              // Delete key from tag map
              state.tagNoteMap = new Map(state.tagNoteMap)
              note.tags.forEach(tag => {
                const tagNoteSet = getOrInitItem(state.tagNoteMap, tag)
                tagNoteSet.delete(noteKey)
              })
            }
          })
        }
      }
      return state
    case 'ADD_STORAGE':
      state = Object.assign({}, state)
      state.storageMap = new Map(state.storageMap)
      state.storageMap.set(action.storage.key, action.storage)

      state.noteMap = new Map(state.noteMap)
      state.storageNoteMap = new Map(state.storageNoteMap)
      state.storageNoteMap.set(action.storage.key, new Set())
      state.folderNoteMap = new Map(state.folderNoteMap)
      state.tagNoteMap = new Map(state.tagNoteMap)
      action.notes.forEach(note => {
        const uniqueKey = note.key
        const folderKey = note.storage + '-' + note.folder
        state.noteMap.set(uniqueKey, note)

        if (note.isStarred) {
          state.starredSet.add(uniqueKey)
        }

        const storageNoteList = getOrInitItem(state.tagNoteMap, note.storage)
        storageNoteList.add(uniqueKey)

        let folderNoteSet = state.folderNoteMap.get(folderKey)
        if (folderNoteSet == null) {
          folderNoteSet = new Set(folderNoteSet)
          state.folderNoteMap.set(folderKey, folderNoteSet)
        }
        folderNoteSet.add(uniqueKey)

        note.tags.forEach(tag => {
          const tagNoteSet = getOrInitItem(state.tagNoteMap, tag)
          tagNoteSet.add(uniqueKey)
        })
      })
      return state
    case 'REMOVE_STORAGE':
      state = Object.assign({}, state)
      const storage = state.storageMap.get(action.storageKey)
      state.storageMap = new Map(state.storageMap)
      state.storageMap.delete(action.storageKey)

      // Remove folders from folderMap
      if (storage != null) {
        state.folderMap = new Map(state.folderMap)
        storage.folders.forEach(folder => {
          const folderKey = storage.key + '-' + folder.key
          state.folderMap.delete(folderKey)
        })
      }

      // Remove notes from noteMap and tagNoteMap
      const storageNoteSet = state.storageNoteMap.get(action.storageKey)
      state.storageNoteMap = new Map(state.storageNoteMap)
      state.storageNoteMap.delete(action.storageKey)
      if (storageNoteSet != null) {
        const notes = storageNoteSet
          .map(noteKey => state.noteMap.get(noteKey))
          .filter(note => note != null)

        state.noteMap = new Map(state.noteMap)
        state.tagNoteMap = new Map(state.tagNoteMap)
        state.starredSet = new Set(state.starredSet)
        notes.forEach(note => {
          const noteKey = note.key
          state.noteMap.delete(noteKey)
          state.starredSet.delete(noteKey)
          note.tags.forEach(tag => {
            let tagNoteSet = state.tagNoteMap.get(tag)
            tagNoteSet = new Set(tagNoteSet)
            tagNoteSet.delete(noteKey)
          })
        })
      }
      return state
    case 'EXPAND_STORAGE':
      state = Object.assign({}, state)
      state.storageMap = new Map(state.storageMap)
      action.storage.isOpen = action.isOpen
      state.storageMap.set(action.storage.key, action.storage)
      return state
    case 'REORDER_STORAGE':
      state = Object.assign({}, state)
      state.storageMap = new Map()
      action.storages.forEach(storage => {
        state.storageMap.set(storage.key, storage)
      })
      return state
  }
  return state
}

const defaultConfig = ConfigManager.get()

function config(state = defaultConfig, action) {
  switch (action.type) {
    case 'SET_IS_SIDENAV_FOLDED':
      state.isSideNavFolded = action.isFolded
      return Object.assign({}, state)
    case 'SET_ZOOM':
      state.zoom = action.zoom
      return Object.assign({}, state)
    case 'SET_LIST_WIDTH':
      state.listWidth = action.listWidth
      return Object.assign({}, state)
    case 'SET_NAV_WIDTH':
      state.navWidth = action.navWidth
      return Object.assign({}, state)
    case 'SET_CONFIG':
      return Object.assign({}, state, action.config)
    case 'SET_UI':
      return Object.assign({}, state, action.config)
  }
  return state
}

const defaultStatus = {
  updateReady: false
}

function status(state = defaultStatus, action) {
  switch (action.type) {
    case 'UPDATE_AVAILABLE':
      return Object.assign({}, defaultStatus, {
        updateReady: true
      })
  }
  return state
}

function updateStarredChange(oldNote, note, state, uniqueKey) {
  if (oldNote == null || oldNote.isStarred !== note.isStarred) {
    state.starredSet = new Set(state.starredSet)
    if (note.isStarred) {
      state.starredSet.add(uniqueKey)
    } else {
      state.starredSet.delete(uniqueKey)
    }
  }
}

function updateFolderChange(oldNote, note, state, folderKey, uniqueKey) {
  if (oldNote == null || oldNote.folder !== note.folder) {
    state.folderNoteMap = new Map(state.folderNoteMap)
    let folderNoteList = state.folderNoteMap.get(folderKey)
    folderNoteList = new Set(folderNoteList)
    folderNoteList.add(uniqueKey)
    state.folderNoteMap.set(folderKey, folderNoteList)

    if (oldNote != null) {
      const oldFolderKey = oldNote.storage + '-' + oldNote.folder
      let oldFolderNoteList = state.folderNoteMap.get(oldFolderKey)
      oldFolderNoteList = new Set(oldFolderNoteList)
      oldFolderNoteList.delete(uniqueKey)
      state.folderNoteMap.set(oldFolderKey, oldFolderNoteList)
    }
  }
}

function updateTagChanges(oldNote, note, state, uniqueKey) {
  const discardedTags = _.difference(oldNote.tags, note.tags)
  const addedTags = _.difference(note.tags, oldNote.tags)
  if (discardedTags.length + addedTags.length > 0) {
    removeFromTags(discardedTags, state, uniqueKey)
    assignToTags(addedTags, state, uniqueKey)
  }
}

function assignToTags(tags, state, uniqueKey) {
  state.tagNoteMap = new Map(state.tagNoteMap)
  tags.forEach(tag => {
    const tagNoteList = getOrInitItem(state.tagNoteMap, tag)
    tagNoteList.add(uniqueKey)
  })
}

function removeFromTags(tags, state, uniqueKey) {
  state.tagNoteMap = new Map(state.tagNoteMap)
  tags.forEach(tag => {
    let tagNoteList = state.tagNoteMap.get(tag)
    if (tagNoteList != null) {
      tagNoteList = new Set(tagNoteList)
      tagNoteList.delete(uniqueKey)
      state.tagNoteMap.set(tag, tagNoteList)
    }
  })
}

function getOrInitItem(target, key) {
  let results = target.get(key)
  if (results == null) {
    results = new Set()
    target.set(key, results)
  }
  return results
}

const history = createHistory()

const reducer = combineReducers({
  data,
  config,
  status,
  router: connectRouter(history)
})

const store = createStore(
  reducer,
  undefined,
  process.env.NODE_ENV === 'development'
    ? compose(
        applyMiddleware(routerMiddleware(history)),
        DevTools.instrument()
      )
    : applyMiddleware(routerMiddleware(history))
)

export { store, history }
