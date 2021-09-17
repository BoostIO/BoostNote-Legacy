const pdfjsLib = require('pdfjs-dist/webpack')

function loop(i, numPages, doc, notes) {
  if (i <= numPages) {
    return new Promise((resolve, reject) => {
      doc.getPage(i).then(page => {
        page.getAnnotations().then(annotations => {
          const content = annotations.map((item, index) => {
            return item.contents
          })
          content.forEach(item => {
            if (!notes.includes(item)) {
              notes.push(item)
            }
          })
          resolve()
        })
      })
    })
      .then(loop.bind(null, i + 1, numPages, doc, notes))
      .then(value => {
        return value
      })
  } else {
    return notes
  }
}

export function getNotes(pdfPath) {
  return new Promise(resolve => {
    const loadingTask = pdfjsLib.getDocument(pdfPath)
    loadingTask.promise.then(doc => {
      const numPages = doc.numPages
      const notes = []
      const x = loop(1, numPages, doc, notes)
      x.then(allNotes => {
        resolve(allNotes)
      })
    })
  })
}
