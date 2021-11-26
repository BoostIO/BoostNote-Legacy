'use strict'

import sanitizeHtml from 'sanitize-html'
import url from 'url'

module.exports = function sanitizePlugin(md, options) {
  options = options || {}

  md.core.ruler.after('linkify', 'sanitize_inline', state => {
    for (let tokenIdx = 0; tokenIdx < state.tokens.length; tokenIdx++) {
      if (state.tokens[tokenIdx].type === 'html_block') {
        state.tokens[tokenIdx].content = sanitizeHtml(
          state.tokens[tokenIdx].content,
          options
        )
      }
      if (state.tokens[tokenIdx].type.match(/.*_fence$/)) {
        // escapeHtmlCharacters has better performance
        state.tokens[tokenIdx].content = state.tokens[tokenIdx].content.replace(
          /[\u00A0-\u9999<>\&]/gim,
          function(i) {
            return '&#' + i.charCodeAt(0) + ';'
          }
        )
      }
      if (state.tokens[tokenIdx].type === 'inline') {
        const inlineTokens = state.tokens[tokenIdx].children
        for (let childIdx = 0; childIdx < inlineTokens.length; childIdx++) {
          if (inlineTokens[childIdx].type === 'html_inline') {
            inlineTokens[childIdx].content = sanitizeInline(
              inlineTokens[childIdx].content,
              options
            )
          }
        }
      }
    }
  })
}

const tagRegex = /<([A-Z][A-Z0-9]*)\s*((?:\s*[A-Z][A-Z0-9]*(?:=("|')(?:[^\3]+?)\3)?)*)\s*\/?>|<\/([A-Z][A-Z0-9]*)\s*>/i
const attributesRegex = /([A-Z][A-Z0-9]*)(?:=("|')([^\2]+?)\2)?/gi

function sanitizeInline(html, options) {
  let match = tagRegex.exec(html)
  if (!match) {
    return ''
  }

  const {
    allowedTags,
    allowedAttributes,
    selfClosing,
    allowedSchemesAppliedToAttributes
  } = options

  if (match[1] !== undefined) {
    // opening tag
    const tag = match[1].toLowerCase()
    if (allowedTags.indexOf(tag) === -1) {
      return ''
    }

    const attributes = match[2]

    let attrs = ''
    let name
    let value

    while ((match = attributesRegex.exec(attributes))) {
      name = match[1].toLowerCase()
      value = match[3]

      if (
        allowedAttributes['*'].indexOf(name) !== -1 ||
        (allowedAttributes[tag] && allowedAttributes[tag].indexOf(name) !== -1)
      ) {
        if (allowedSchemesAppliedToAttributes.indexOf(name) !== -1) {
          if (
            naughtyHRef(value, options) ||
            (tag === 'iframe' &&
              name === 'src' &&
              naughtyIFrame(value, options))
          ) {
            continue
          }
        }

        attrs += ` ${name}`
        if (match[2]) {
          attrs += `="${value}"`
        }
      }
    }

    if (selfClosing.indexOf(tag) === -1) {
      return '<' + tag + attrs + '>'
    } else {
      return '<' + tag + attrs + ' />'
    }
  } else {
    // closing tag
    if (allowedTags.indexOf(match[4].toLowerCase()) !== -1) {
      return html
    } else {
      return ''
    }
  }
}

function naughtyHRef(href, options) {
  // href = href.replace(/[\x00-\x20]+/g, '')
  if (!href) {
    // No href
    return false
  }
  href = href.replace(/<\!\-\-.*?\-\-\>/g, '')

  const matches = href.match(/^([a-zA-Z]+)\:/)
  if (!matches) {
    if (href.match(/^[\/\\]{2}/)) {
      return !options.allowProtocolRelative
    }

    // No scheme
    return false
  }

  const scheme = matches[1].toLowerCase()

  return options.allowedSchemes.indexOf(scheme) === -1
}

function naughtyIFrame(src, options) {
  try {
    const parsed = url.parse(src, false, true)

    return options.allowedIframeHostnames.index(parsed.hostname) === -1
  } catch (e) {
    return true
  }
}
