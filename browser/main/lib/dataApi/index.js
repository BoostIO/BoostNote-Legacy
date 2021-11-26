const dataApi = {
  init: require('./init'),
  toggleStorage: require('./toggleStorage'),
  addStorage: require('./addStorage'),
  renameStorage: require('./renameStorage'),
  removeStorage: require('./removeStorage'),
  reorderStorage: require('./reorderStorage'),
  createFolder: require('./createFolder'),
  updateFolder: require('./updateFolder'),
  deleteFolder: require('./deleteFolder'),
  reorderFolder: require('./reorderFolder'),
  exportFolder: require('./exportFolder'),
  exportStorage: require('./exportStorage'),
  createNote: require('./createNote'),
  createNoteFromUrl: require('./createNoteFromUrl'),
  updateNote: require('./updateNote'),
  deleteNote: require('./deleteNote'),
  moveNote: require('./moveNote'),
  exportNoteAs: require('./exportNoteAs'),
  migrateFromV5Storage: require('./migrateFromV5Storage'),
  createSnippet: require('./createSnippet'),
  deleteSnippet: require('./deleteSnippet'),
  updateSnippet: require('./updateSnippet'),
  fetchSnippet: require('./fetchSnippet'),
  exportTag: require('./exportTag'),
  getFilename: require('./getFilename'),

  _migrateFromV6Storage: require('./migrateFromV6Storage'),
  _resolveStorageData: require('./resolveStorageData'),
  _resolveStorageNotes: require('./resolveStorageNotes')
}

module.exports = dataApi
