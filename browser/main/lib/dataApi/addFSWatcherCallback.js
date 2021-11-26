'use strict'
const _ = require('lodash')
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const CSON = require('@rokt33r/season')

module.exports = (callbackAddedOrChanged, callbackRemoved) => {
  const rawStorages = JSON.parse(window.localStorage.getItem('storages'))
  if (!_.isArray(rawStorages)) {
    console.warn('Failed to parse cached data from localStorage')
    return
  }
  const storages = rawStorages
    .filter(storage => fs.existsSync(storage.path))
    .map(storage => {
      storage.path = path.resolve(storage.path, 'notes')
      return storage
    })
  const locations = storages.map(storage => path.join(storage.path, '*.cson'))
  if (!locations.length) return
  chokidar.watch(locations).on('add', (notePath, event) => {
    try {
      callbackAddedOrChanged(parseCSONFile(path.resolve(notePath), storages))
    } catch (err) {
      console.error(`error on note path: ${notePath}, error: ${err}`)
    }
  })
  chokidar.watch(locations).on('change', (notePath, event) => {
    try {
      callbackAddedOrChanged(parseCSONFile(path.resolve(notePath), storages))
    } catch (err) {
      console.error(`error on note path: ${notePath}, error: ${err}`)
    }
  })
  chokidar.watch(locations).on('unlink', (notePath, event) => {
    try {
      callbackRemoved(path.basename(notePath, '.cson'))
    } catch (err) {
      console.error(`error on note path: ${notePath}, error: ${err}`)
    }
  })
}

function parseCSONFile(notePath, storages) {
  const data = CSON.readFileSync(notePath)
  data.key = path.basename(notePath, '.cson')
  const storage = storages.filter(
    storage => storage.path === path.dirname(notePath)
  )[0]
  if (!storage) {
    throw new Error(
      `Note in path ${notePath} isn't assigned to a valid storage`
    )
  }
  data.storage = storage.key
  return data
}
