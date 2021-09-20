import path from 'path'
import fileUrl from 'file-url'
import fs from 'fs'
import { remote } from 'electron'
import consts from 'browser/lib/consts'
import Markdown from 'browser/lib/markdown'
import attachmentManagement from './attachmentManagement'
import { version as codemirrorVersion } from 'codemirror/package.json'
import { escapeHtmlCharacters } from 'browser/lib/utils'

const { app } = remote
const appPath = fileUrl(
  process.env.NODE_ENV === 'production' ? app.getAppPath() : path.resolve()
)

let markdownStyle = ''
try {
  markdownStyle = require('!!css!stylus?sourceMap!../../../components/markdown.styl')[0][1]
} catch (e) {}

export const CSS_FILES = [
  `${appPath}/node_modules/katex/dist/katex.min.css`,
  `${appPath}/node_modules/codemirror/lib/codemirror.css`,
  `${appPath}/node_modules/react-image-carousel/lib/css/main.min.css`
]

const macos = global.process.platform === 'darwin'

const defaultFontFamily = ['helvetica', 'arial', 'sans-serif']
if (!macos) {
  defaultFontFamily.unshift('Microsoft YaHei')
  defaultFontFamily.unshift('meiryo')
}

const defaultCodeBlockFontFamily = [
  'Monaco',
  'Menlo',
  'Ubuntu Mono',
  'Consolas',
  'source-code-pro',
  'monospace'
]

function unprefix(file) {
  if (global.process.platform === 'win32') {
    return file.replace('file:///', '')
  } else {
    return file.replace('file://', '')
  }
}

/**
 * ```
 * {
 *   fontFamily,
 *   fontSize,
 *   lineNumber,
 *   codeBlockFontFamily,
 *   codeBlockTheme,
 *   scrollPastEnd,
 *   theme,
 *   allowCustomCSS,
 *   customCSS
 *   smartQuotes,
 *   sanitize,
 *   breaks,
 *   storagePath,
 *   export,
 *   indentSize
 * }
 * ```
 */
export default function formatHTML(props) {
  const {
    fontFamily,
    fontSize,
    codeBlockFontFamily,
    lineNumber,
    codeBlockTheme,
    scrollPastEnd,
    theme,
    allowCustomCSS,
    customCSS
  } = getStyleParams(props)

  const inlineStyles = buildStyle(
    fontFamily,
    fontSize,
    codeBlockFontFamily,
    lineNumber,
    scrollPastEnd,
    theme,
    allowCustomCSS,
    customCSS
  )

  const { smartQuotes, sanitize, breaks } = props

  let indentSize = parseInt(props.indentSize, 10)
  if (!(indentSize > 0 && indentSize < 132)) {
    indentSize = 4
  }

  const files = [getCodeThemeLink(codeBlockTheme), ...CSS_FILES]

  return function(note, targetPath, exportTasks) {
    const styles = files
      .map(file => `<link rel="stylesheet" href="css/${path.basename(file)}">`)
      .join('\n')

    let inlineScripts = ''
    let scripts = ''

    let decodeEntities = false
    function addDecodeEntities() {
      if (decodeEntities) {
        return
      }

      decodeEntities = true

      inlineScripts += `
function decodeEntities (text) {
  var entities = [
    ['apos', '\\''],
    ['amp', '&'],
    ['lt', '<'],
    ['gt', '>'],
    ['#63', '\\?'],
    ['#36', '\\$']
  ]

  for (var i = 0, max = entities.length; i < max; ++i) {
    text = text.replace(new RegExp(\`&\${entities[i][0]};\`, 'g'), entities[i][1])
  }

  return text
}`
    }

    let lodash = false
    function addLodash() {
      if (lodash) {
        return
      }

      lodash = true

      exportTasks.push({
        src: unprefix(`${appPath}/node_modules/lodash/lodash.min.js`),
        dst: 'js'
      })

      scripts += `<script src="js/lodash.min.js"></script>`
    }

    let raphael = false
    function addRaphael() {
      if (raphael) {
        return
      }

      raphael = true

      exportTasks.push({
        src: unprefix(`${appPath}/node_modules/raphael/raphael.min.js`),
        dst: 'js'
      })

      scripts += `<script src="js/raphael.min.js"></script>`
    }

    let yaml = false
    function addYAML() {
      if (yaml) {
        return
      }

      yaml = true

      exportTasks.push({
        src: unprefix(`${appPath}/node_modules/js-yaml/dist/js-yaml.min.js`),
        dst: 'js'
      })

      scripts += `<script src="js/js-yaml.min.js"></script>`
    }

    let chart = false
    function addChart() {
      if (chart) {
        return
      }

      chart = true

      addLodash()

      exportTasks.push({
        src: unprefix(`${appPath}/node_modules/chart.js/dist/Chart.min.js`),
        dst: 'js'
      })

      scripts += `<script src="js/Chart.min.js"></script>`

      inlineScripts += `
function displayCharts() {
  _.forEach(
    document.querySelectorAll('.chart'),
    el => {
      try {
        const format = el.attributes.getNamedItem('data-format').value
        const chartConfig = format === 'yaml' ? jsyaml.load(el.innerHTML) : JSON.parse(el.innerHTML)
        el.innerHTML = ''

        const canvas = document.createElement('canvas')
        el.appendChild(canvas)

        const height = el.attributes.getNamedItem('data-height')
        if (height && height.value !== 'undefined') {
          el.style.height = height.value + 'vh'
          canvas.height = height.value + 'vh'
        }

        const chart = new Chart(canvas, chartConfig)
      } catch (e) {
        el.className = 'chart-error'
        el.innerHTML = 'chartjs diagram parse error: ' + e.message
      }
    }
  )
}

document.addEventListener('DOMContentLoaded', displayCharts);
`
    }

    let codemirror = false
    function addCodeMirror() {
      if (codemirror) {
        return
      }

      codemirror = true

      addDecodeEntities()
      addLodash()

      exportTasks.push(
        {
          src: unprefix(`${appPath}/node_modules/codemirror/lib/codemirror.js`),
          dst: 'js/codemirror'
        },
        {
          src: unprefix(`${appPath}/node_modules/codemirror/mode/meta.js`),
          dst: 'js/codemirror/mode'
        },
        {
          src: unprefix(
            `${appPath}/node_modules/codemirror/addon/mode/loadmode.js`
          ),
          dst: 'js/codemirror/addon/mode'
        },
        {
          src: unprefix(
            `${appPath}/node_modules/codemirror/addon/runmode/runmode.js`
          ),
          dst: 'js/codemirror/addon/runmode'
        }
      )

      scripts += `
<script src="js/codemirror/codemirror.js"></script>
<script src="js/codemirror/mode/meta.js"></script>
<script src="js/codemirror/addon/mode/loadmode.js"></script>
<script src="js/codemirror/addon/runmode/runmode.js"></script>
`

      let className = `cm-s-${codeBlockTheme}`
      if (codeBlockTheme.indexOf('solarized') === 0) {
        const [refThema, color] = codeBlockTheme.split(' ')
        className = `cm-s-${refThema} cm-s-${color}`
      }

      inlineScripts += `
CodeMirror.modeURL = 'https://cdn.jsdelivr.net/npm/codemirror@${codemirrorVersion}/mode/%N/%N.js';

function displayCodeBlocks() {
  _.forEach(
    document.querySelectorAll('.code code'),
    el => {
      el.parentNode.className += ' ${className}'
      let syntax = CodeMirror.findModeByName(el.className)
      if (syntax == null) syntax = CodeMirror.findModeByName('Plain Text')
      CodeMirror.requireMode(syntax.mode, () => {
        const content = decodeEntities(el.innerHTML)
        el.innerHTML = ''
        CodeMirror.runMode(content, syntax.mime, el, {
          tabSize: ${indentSize}
        })
      })
    }
  )
}

document.addEventListener('DOMContentLoaded', displayCodeBlocks);
`
    }

    let flowchart = false
    function addFlowchart() {
      if (flowchart) {
        return
      }

      flowchart = true

      addDecodeEntities()
      addLodash()
      addRaphael()

      exportTasks.push({
        src: unprefix(
          `${appPath}/node_modules/flowchart.js/release/flowchart.min.js`
        ),
        dst: 'js'
      })

      scripts += `<script src="js/flowchart.min.js"></script>`

      inlineScripts += `
function displayFlowcharts() {
  _.forEach(
    document.querySelectorAll('.flowchart'),
    el => {
      try {
        const diagram = flowchart.parse(
          decodeEntities(el.innerHTML)
        )
        el.innerHTML = ''
        diagram.drawSVG(el)
      } catch (e) {
        el.className = 'flowchart-error'
        el.innerHTML = 'Flowchart parse error: ' + e.message
      }
    }
  )
}

document.addEventListener('DOMContentLoaded', displayFlowcharts);
`
    }

    let mermaid = false
    function addMermaid() {
      if (mermaid) {
        return
      }

      mermaid = true

      addLodash()

      exportTasks.push({
        src: unprefix(`${appPath}/node_modules/mermaid/dist/mermaid.min.js`),
        dst: 'js'
      })

      scripts += `<script src="js/mermaid.min.js"></script>`

      inlineScripts += `
function displayMermaids() {
  _.forEach(
    document.querySelectorAll('.mermaid'),
    el => {
      const height = el.attributes.getNamedItem('data-height')
      if (height && height.value !== 'undefined') {
        el.style.height = height.value + 'vh'
      }
    }
  )
}

document.addEventListener('DOMContentLoaded', displayMermaids);
`
    }

    let sequence = false
    function addSequence() {
      if (sequence) {
        return
      }

      sequence = true

      addDecodeEntities()
      addLodash()
      addRaphael()

      exportTasks.push({
        src: unprefix(
          `${appPath}/node_modules/@rokt33r/js-sequence-diagrams/dist/sequence-diagram-min.js`
        ),
        dst: 'js'
      })

      scripts += `<script src="js/sequence-diagram-min.js"></script>`

      inlineScripts += `
function displaySequences() {
  _.forEach(
    document.querySelectorAll('.sequence'),
    el => {
       try {
        const diagram = Diagram.parse(
          decodeEntities(el.innerHTML)
        )
        el.innerHTML = ''
        diagram.drawSVG(el, { theme: 'simple' })
      } catch (e) {
        el.className = 'sequence-error'
        el.innerHTML = 'Sequence diagram parse error: ' + e.message
      }
    }
  )
}

document.addEventListener('DOMContentLoaded', displaySequences);
`
    }

    const modes = {}
    const markdown = new Markdown({
      typographer: smartQuotes,
      sanitize,
      breaks,
      onFence(type, mode) {
        if (type === 'chart') {
          addChart()

          if (mode === 'yaml') {
            addYAML()
          }
        } else if (type === 'code') {
          addCodeMirror()

          if (mode && modes[mode] !== true) {
            const file = unprefix(
              `${appPath}/node_modules/codemirror/mode/${mode}/${mode}.js`
            )

            if (fs.existsSync(file)) {
              exportTasks.push({
                src: file,
                dst: `js/codemirror/mode/${mode}`
              })

              modes[mode] = true
            }
          }
        } else if (type === 'flowchart') {
          addFlowchart()
        } else if (type === 'mermaid') {
          addMermaid()
        } else if (type === 'sequence') {
          addSequence()
        }
      }
    })

    let body = note.content

    if (sanitize === 'NONE') {
      body = escapeHtmlCharactersInCodeTag(body.split('```'))
    }

    body = markdown.render(note.content)

    const attachmentsAbsolutePaths = attachmentManagement.getAbsolutePathsOfAttachmentsInContent(
      note.content,
      props.storagePath
    )

    files.forEach(file => {
      exportTasks.push({
        src: unprefix(file),
        dst: 'css'
      })
    })

    const destinationFolder = props.export.prefixAttachmentFolder
      ? `${path.parse(targetPath).name} - ${
          attachmentManagement.DESTINATION_FOLDER
        }`
      : attachmentManagement.DESTINATION_FOLDER

    attachmentsAbsolutePaths.forEach(attachment => {
      exportTasks.push({
        src: attachment,
        dst: destinationFolder
      })
    })

    body = attachmentManagement.replaceStorageReferences(
      body,
      note.key,
      destinationFolder
    )

    return `
<html>
<head>
  <meta charset="UTF-8">
  <meta name = "viewport" content = "width = device-width, initial-scale = 1, maximum-scale = 1">
  <style id="style">${inlineStyles}</style>
  ${styles}
  ${scripts}
  <script>${inlineScripts}</script>
</head>
<body data-theme="${theme}">
${body}
</body>
</html>
`
  }
}

export function getStyleParams(props) {
  const {
    fontSize,
    lineNumber,
    codeBlockTheme,
    scrollPastEnd,
    theme,
    allowCustomCSS,
    customCSS,
    RTL
  } = props

  let { fontFamily, codeBlockFontFamily } = props

  fontFamily =
    _.isString(fontFamily) && fontFamily.trim().length > 0
      ? fontFamily
          .split(',')
          .map(fontName => fontName.trim())
          .concat(defaultFontFamily)
      : defaultFontFamily

  codeBlockFontFamily =
    _.isString(codeBlockFontFamily) && codeBlockFontFamily.trim().length > 0
      ? codeBlockFontFamily
          .split(',')
          .map(fontName => fontName.trim())
          .concat(defaultCodeBlockFontFamily)
      : defaultCodeBlockFontFamily

  return {
    fontFamily,
    fontSize,
    codeBlockFontFamily,
    lineNumber,
    codeBlockTheme,
    scrollPastEnd,
    theme,
    allowCustomCSS,
    customCSS,
    RTL
  }
}

export function getCodeThemeLink(name) {
  const theme = consts.THEMES.find(theme => theme.name === name)

  return theme != null
    ? theme.path
    : `${appPath}/node_modules/codemirror/theme/elegant.css`
}

export function buildStyle(
  fontFamily,
  fontSize,
  codeBlockFontFamily,
  lineNumber,
  scrollPastEnd,
  theme,
  allowCustomCSS,
  customCSS,
  RTL
) {
  return `
@font-face {
  font-family: 'Lato';
  src: url('${appPath}/resources/fonts/Lato-Regular.woff2') format('woff2'), /* Modern Browsers */
       url('${appPath}/resources/fonts/Lato-Regular.woff') format('woff'), /* Modern Browsers */
       url('${appPath}/resources/fonts/Lato-Regular.ttf') format('truetype');
  font-style: normal;
  font-weight: normal;
  text-rendering: optimizeLegibility;
}
@font-face {
  font-family: 'Lato';
  src: url('${appPath}/resources/fonts/Lato-Black.woff2') format('woff2'), /* Modern Browsers */
       url('${appPath}/resources/fonts/Lato-Black.woff') format('woff'), /* Modern Browsers */
       url('${appPath}/resources/fonts/Lato-Black.ttf') format('truetype');
  font-style: normal;
  font-weight: 700;
  text-rendering: optimizeLegibility;
}
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: local('Material Icons'),
       local('MaterialIcons-Regular'),
       url('${appPath}/resources/fonts/MaterialIcons-Regular.woff2') format('woff2'),
       url('${appPath}/resources/fonts/MaterialIcons-Regular.woff') format('woff'),
       url('${appPath}/resources/fonts/MaterialIcons-Regular.ttf') format('truetype');
}
${markdownStyle}

body {
  font-family: '${fontFamily.join("','")}';
  font-size: ${fontSize}px;
  ${scrollPastEnd && 'padding-bottom: 90vh;box-sizing: border-box;'}
  ${RTL && 'direction: rtl;text-align: right;'}
}
@media print {
  body {
    padding-bottom: initial;
  }
}

code {
  font-family: '${codeBlockFontFamily.join("','")}';
  background-color: rgba(0,0,0,0.04);
  text-align: left;
  direction: ltr;
}

p code.inline,
li code.inline,
td code.inline
{
  padding: 2px;
  border-width: 1px;
  border-style: solid;
  border-radius: 5px;
}
[data-theme="default"] p code.inline,
[data-theme="default"] li code.inline,
[data-theme="default"] td code.inline
{
  background-color: #F4F4F4;
  border-color: #d9d9d9;
  color: inherit;
}
[data-theme="white"] p code.inline,
[data-theme="white"] li code.inline,
[data-theme="white"] td code.inline
{
  background-color: #F4F4F4;
  border-color: #d9d9d9;
  color: inherit;
}
[data-theme="dark"] p code.inline,
[data-theme="dark"] li code.inline,
[data-theme="dark"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}
[data-theme="dracula"] p code.inline,
[data-theme="dracula"] li code.inline,
[data-theme="dracula"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}
[data-theme="monokai"] p code.inline,
[data-theme="monokai"] li code.inline,
[data-theme="monokai"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}
[data-theme="nord"] p code.inline,
[data-theme="nord"] li code.inline,
[data-theme="nord"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}
[data-theme="solarized-dark"] p code.inline,
[data-theme="solarized-dark"] li code.inline,
[data-theme="solarized-dark"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}
[data-theme="vulcan"] p code.inline,
[data-theme="vulcan"] li code.inline,
[data-theme="vulcan"] td code.inline
{
  background-color: #444444;
  border-color: #555;
  color: #FFFFFF;
}

.lineNumber {
  ${lineNumber && 'display: block !important;'}
  font-family: '${codeBlockFontFamily.join("','")}';
}

.clipboardButton {
  color: rgba(147,147,149,0.8);;
  fill: rgba(147,147,149,1);;
  border-radius: 50%;
  margin: 0px 10px;
  border: none;
  background-color: transparent;
  outline: none;
  height: 15px;
  width: 15px;
  cursor: pointer;
}

.clipboardButton:hover {
  transition: 0.2s;
  color: #939395;
  fill: #939395;
  background-color: rgba(0,0,0,0.1);
}

h1, h2 {
  border: none;
}

h1 {
  padding-bottom: 4px;
  margin: 1em 0 8px;
}

h2 {
  padding-bottom: 0.2em;
  margin: 1em 0 0.37em;
}

body p {
  white-space: normal;
}

@media print {
  body[data-theme="${theme}"] {
    color: #000;
    background-color: #fff;
  }

  table {
    overflow-x: visible;
    table-layout: fixed;
  }

  table tbody td {
    word-break: break-word;
  }

  .clipboardButton {
    display: none
  }
}

${allowCustomCSS ? customCSS : ''}
`
}

/**
 * @description Convert special characters between three ```
 * @param {string[]} splitWithCodeTag Array of HTML strings separated by three ```
 * @returns {string} HTML in which special characters between three ``` have been converted
 */
export function escapeHtmlCharactersInCodeTag(splitWithCodeTag) {
  for (let index = 0; index < splitWithCodeTag.length; index++) {
    const codeTagRequired =
      splitWithCodeTag[index] !== '```' && index < splitWithCodeTag.length - 1
    if (codeTagRequired) {
      splitWithCodeTag.splice(index + 1, 0, '```')
    }
  }
  let inCodeTag = false
  let result = ''
  for (let content of splitWithCodeTag) {
    if (content === '```') {
      inCodeTag = !inCodeTag
    } else if (inCodeTag) {
      content = escapeHtmlCharacters(content)
    }
    result += content
  }
  return result
}
