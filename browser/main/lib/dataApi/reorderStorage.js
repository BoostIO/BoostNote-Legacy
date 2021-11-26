const _ = require('lodash')
_.move = require('lodash-move').default
const resolveStorageData = require('./resolveStorageData')

/**
 * @param {Number} oldIndex
 * @param {Number} newIndex
 * @return {Object} Storage meta data
 */
function reorderStorage(oldIndex, newIndex) {
  let rawStorages
  try {
    rawStorages = JSON.parse(localStorage.getItem('storages'))
    if (!_.isArray(rawStorages)) throw new Error('invalid storages')
    if (!_.isNumber(oldIndex)) throw new Error('oldIndex must be a number.')
    if (!_.isNumber(newIndex)) throw new Error('newIndex must be a number.')
  } catch (e) {
    console.warn(e)
    return Promise.reject(e)
  }
  return Promise.resolve(rawStorages).then(function moveSaveStorageToLocal() {
    const resultStorage = _.move(rawStorages, oldIndex, newIndex)
    localStorage.setItem('storages', JSON.stringify(resultStorage))
    const resolvedStorage = resultStorage.map(function(storage) {
      return resolveStorageData(storage)
    })
    return Promise.all(resolvedStorage).then(function(storages) {
      return Promise.resolve({ storages })
    })
  })
}
module.exports = reorderStorage
