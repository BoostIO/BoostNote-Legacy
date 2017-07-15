const sander = require('sander')
const resolveStorageData = require('./resolveStorageData')
const _ = require('lodash')
const keygen = require('browser/lib/keygen')
const path = require('path')
const CSON = require('@rokt33r/season')

function validateInput (input) {
  if (!_.isArray(input.tags)) input.tags = []
  input.tags = input.tags.filter((tag) => _.isString(tag) && tag.trim().length > 0)
  if (!_.isString(input.title)) input.title = ''
  input.isStarred = !!input.isStarred
  input.isTrashed = !!input.isTrashed

  switch (input.type) {
    case 'MARKDOWN_NOTE':
      if (!_.isString(input.content)) input.content = ''
      break
    case 'SNIPPET_NOTE':
      if (!_.isString(input.description)) input.description = ''
      if (!_.isArray(input.snippets)) {
        input.snippets = [{
          name: '',
          mode: 'text',
          content: ''
        }]
      }
      break
    default:
      throw new Error('Invalid type: only MARKDOWN_NOTE and SNIPPET_NOTE are available.')
  }
}

function createNote (storageKey, input) {
  let targetStorage
  try {
    if (input == null) throw new Error('No input found.')
    input = Object.assign({}, input)
    validateInput(input)

    let cachedStorageList = JSON.parse(localStorage.getItem('storages'))
    if (!_.isArray(cachedStorageList)) throw new Error('Target storage doesn\'t exist.')

    targetStorage = _.find(cachedStorageList, {key: storageKey})
    if (targetStorage == null) throw new Error('Target storage doesn\'t exist.')
  } catch (e) {
    return Promise.reject(e)
  }

  return resolveStorageData(targetStorage)
    .then(function checkFolderExists (storage) {
      if (_.find(storage.folders, {key: input.folder}) == null) {
        throw new Error('Target folder doesn\'t exist.')
      }
      return storage
    })
    .then(function saveNote (storage) {
      let key = keygen()
      let isUnique = false
      while (!isUnique) {
        try {
          sander.statSync(path.join(storage.path, 'notes', key + '.cson'))
          key = keygen()
        } catch (err) {
          if (err.code === 'ENOENT') {
            isUnique = true
          } else {
            throw err
          }
        }
      }
      let noteData = Object.assign({}, input, {
        key,
        createdAt: new Date(),
        updatedAt: new Date(),
        storage: storageKey
      })

      CSON.writeFileSync(path.join(storage.path, 'notes', key + '.cson'), _.omit(noteData, ['key', 'storage']))

      return noteData
    })
}

module.exports = createNote
