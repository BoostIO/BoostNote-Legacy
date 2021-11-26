const test = require('ava')
const reorderStorage = require('browser/main/lib/dataApi/reorderStorage')

global.document = require('jsdom').jsdom('<body></body>')
global.window = document.defaultView
global.navigator = window.navigator

const Storage = require('dom-storage')
const localStorage = (window.localStorage = global.localStorage = new Storage(
  null,
  { strict: true }
))
const path = require('path')
const _ = require('lodash')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')

const storagePath = path.join(os.tmpdir(), 'test/reorder-storage')

test.beforeEach(t => {
  t.context.storages = [
    TestDummy.dummyStorage(storagePath),
    TestDummy.dummyStorage(storagePath)
  ]
  localStorage.setItem(
    'storages',
    JSON.stringify([t.context.storages[0].cache, t.context.storages[1].cache])
  )
})

test.serial('Reorder a storage', t => {
  const firstStorageKey = t.context.storages[0].cache.key
  const secondStorageKey = t.context.storages[1].cache.key

  return Promise.resolve()
    .then(function doTest() {
      return reorderStorage(0, 1)
    })
    .then(function assert(data) {
      t.true(_.nth(data.storages, 0).key === secondStorageKey)
      t.true(_.nth(data.storages, 1).key === firstStorageKey)

      const jsonData = JSON.parse(localStorage.getItem('storages'))

      t.true(_.nth(jsonData, 0).key === secondStorageKey)
      t.true(_.nth(jsonData, 1).key === firstStorageKey)
    })
})

test.after(function after() {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
