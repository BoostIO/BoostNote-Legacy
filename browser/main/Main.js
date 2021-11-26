import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './Main.styl'
import { connect } from 'react-redux'
import SideNav from './SideNav'
import TopBar from './TopBar'
import NoteList from './NoteList'
import Detail from './Detail'
import dataApi from 'browser/main/lib/dataApi'
import _ from 'lodash'
import ConfigManager from 'browser/main/lib/ConfigManager'
import mobileAnalytics from 'browser/main/lib/AwsMobileAnalyticsConfig'
import eventEmitter from 'browser/main/lib/eventEmitter'
import { store } from 'browser/main/store'
import i18n from 'browser/lib/i18n'
import { getLocales } from 'browser/lib/Languages'
import applyShortcuts from 'browser/main/lib/shortcutManager'
import { chooseTheme, applyTheme } from 'browser/main/lib/ThemeManager'
import { push } from 'connected-react-router'
import { ipcRenderer } from 'electron'

const path = require('path')
const electron = require('electron')
const { remote } = electron

class Main extends React.Component {
  constructor(props) {
    super(props)

    if (process.env.NODE_ENV === 'production') {
      mobileAnalytics.initAwsMobileAnalytics()
    }

    const { config } = props

    this.state = {
      isRightSliderFocused: false,
      listWidth: config.listWidth,
      navWidth: config.navWidth,
      isLeftSliderFocused: false,
      fullScreen: false,
      noteDetailWidth: 0,
      mainBodyWidth: 0
    }

    this.toggleFullScreen = () => this.handleFullScreenButton()
  }

  getChildContext() {
    const { status, config } = this.props

    return {
      status,
      config
    }
  }

  init() {
    dataApi
      .addStorage({
        name: 'My Storage Location',
        path: path.join(remote.app.getPath('home'), 'Boostnote')
      })
      .then(data => {
        return data
      })
      .then(data => {
        if (data.storage.folders[0] != null) {
          return data
        } else {
          return dataApi
            .createFolder(data.storage.key, {
              color: '#1278BD',
              name: 'Default'
            })
            .then(_data => {
              return {
                storage: _data.storage,
                notes: data.notes
              }
            })
        }
      })
      .then(data => {
        store.dispatch({
          type: 'ADD_STORAGE',
          storage: data.storage,
          notes: data.notes
        })

        const defaultSnippetNote = dataApi
          .createNote(data.storage.key, {
            type: 'SNIPPET_NOTE',
            folder: data.storage.folders[0].key,
            title: 'Snippet note example',
            description:
              'Snippet note example\nYou can store a series of snippets as a single note, like Gist.',
            snippets: [
              {
                name: 'example.html',
                mode: 'html',
                content:
                  "<html>\n<body>\n<h1 id='hello'>Enjoy Boostnote!</h1>\n</body>\n</html>",
                linesHighlighted: []
              },
              {
                name: 'example.js',
                mode: 'javascript',
                content:
                  "var boostnote = document.getElementById('hello').innerHTML\n\nconsole.log(boostnote)",
                linesHighlighted: []
              }
            ]
          })
          .then(note => {
            store.dispatch({
              type: 'UPDATE_NOTE',
              note: note
            })
          })
        const defaultMarkdownNote = dataApi
          .createNote(data.storage.key, {
            type: 'MARKDOWN_NOTE',
            folder: data.storage.folders[0].key,
            title: 'Welcome to Boostnote!',
            content:
              '# Welcome to Boostnote!\n## Click here to edit markdown :wave:\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/L0qNPLsvmyM" frameborder="0" allowfullscreen></iframe>\n\n## Docs :memo:\n- [Boostnote | Boost your happiness, productivity and creativity.](https://hackernoon.com/boostnote-boost-your-happiness-productivity-and-creativity-315034efeebe)\n- [Cloud Syncing & Backups](https://github.com/BoostIO/Boostnote/wiki/Cloud-Syncing-and-Backup)\n- [How to sync your data across Desktop and Mobile apps](https://github.com/BoostIO/Boostnote/wiki/Sync-Data-Across-Desktop-and-Mobile-apps)\n- [Convert data from **Evernote** to Boostnote.](https://github.com/BoostIO/Boostnote/wiki/Evernote)\n- [Keyboard Shortcuts](https://github.com/BoostIO/Boostnote/wiki/Keyboard-Shortcuts)\n- [Keymaps in Editor mode](https://github.com/BoostIO/Boostnote/wiki/Keymaps-in-Editor-mode)\n- [How to set syntax highlight in Snippet note](https://github.com/BoostIO/Boostnote/wiki/Syntax-Highlighting)\n\n---\n\n## Article Archive :books:\n- [Reddit English](http://bit.ly/2mOJPu7)\n- [Reddit Spanish](https://www.reddit.com/r/boostnote_es/)\n- [Reddit Chinese](https://www.reddit.com/r/boostnote_cn/)\n- [Reddit Japanese](https://www.reddit.com/r/boostnote_jp/)\n\n---\n\n## Community :beers:\n- [GitHub](http://bit.ly/2AWWzkD)\n- [Twitter](http://bit.ly/2z8BUJZ)\n- [Facebook Group](http://bit.ly/2jcca8t)'
          })
          .then(note => {
            store.dispatch({
              type: 'UPDATE_NOTE',
              note: note
            })
          })

        return Promise.resolve(defaultSnippetNote)
          .then(defaultMarkdownNote)
          .then(() => data.storage)
      })
      .then(storage => {
        store.dispatch(push('/storages/' + storage.key))
      })
      .catch(err => {
        throw err
      })
  }

  componentDidMount() {
    const { dispatch, config } = this.props

    this.refreshTheme = setInterval(() => {
      const conf = ConfigManager.get()
      chooseTheme(conf)
    }, 5 * 1000)

    chooseTheme(config)
    applyTheme(config.ui.theme)

    if (getLocales().indexOf(config.ui.language) !== -1) {
      i18n.setLocale(config.ui.language)
    } else {
      i18n.setLocale('en')
    }
    applyShortcuts()
    // Reload all data
    dataApi.init().then(data => {
      dispatch({
        type: 'INIT_ALL',
        storages: data.storages,
        notes: data.notes
      })

      if (data.storages.length < 1) {
        this.init()
      }
    })

    const cbAddedOrChanged = note => {
      dispatch({
        type: 'UPDATE_NOTE',
        note
      })
    }
    const cbRemoved = noteKey => {
      dispatch({
        type: 'DELETE_NOTE',
        noteKey
      })
    }
    dataApi.addFSWatcherCallback(cbAddedOrChanged, cbRemoved)

    // eslint-disable-next-line no-undef
    delete CodeMirror.keyMap.emacs['Ctrl-V']

    eventEmitter.on('editor:fullscreen', this.toggleFullScreen)
    eventEmitter.on(
      'menubar:togglemenubar',
      this.toggleMenuBarVisible.bind(this)
    )
    eventEmitter.on('dispatch:push', this.changeRoutePush.bind(this))
    eventEmitter.on('update', () => ipcRenderer.send('update-check', 'manual'))
  }

  componentWillUnmount() {
    eventEmitter.off('editor:fullscreen', this.toggleFullScreen)
    eventEmitter.off(
      'menubar:togglemenubar',
      this.toggleMenuBarVisible.bind(this)
    )
    eventEmitter.off('dispatch:push', this.changeRoutePush.bind(this))
    clearInterval(this.refreshTheme)
  }

  changeRoutePush(event, destination) {
    const { dispatch } = this.props
    dispatch(push(destination))
  }

  toggleMenuBarVisible() {
    const { config } = this.props
    const { ui } = config

    const newUI = Object.assign(ui, { showMenuBar: !ui.showMenuBar })
    const newConfig = Object.assign(config, newUI)
    ConfigManager.set(newConfig)
  }

  handleLeftSlideMouseDown(e) {
    e.preventDefault()
    this.setState({
      isLeftSliderFocused: true
    })
  }

  handleRightSlideMouseDown(e) {
    e.preventDefault()
    this.setState({
      isRightSliderFocused: true
    })
  }

  handleMouseUp(e) {
    // Change width of NoteList component.
    if (this.state.isRightSliderFocused) {
      this.setState(
        {
          isRightSliderFocused: false
        },
        () => {
          const { dispatch } = this.props
          const newListWidth = this.state.listWidth
          // TODO: ConfigManager should dispatch itself.
          ConfigManager.set({ listWidth: newListWidth })
          dispatch({
            type: 'SET_LIST_WIDTH',
            listWidth: newListWidth
          })
        }
      )
    }

    // Change width of SideNav component.
    if (this.state.isLeftSliderFocused) {
      this.setState(
        {
          isLeftSliderFocused: false
        },
        () => {
          const { dispatch } = this.props
          const navWidth = this.state.navWidth
          // TODO: ConfigManager should dispatch itself.
          ConfigManager.set({ navWidth })
          dispatch({
            type: 'SET_NAV_WIDTH',
            navWidth
          })
        }
      )
    }
  }

  handleMouseMove(e) {
    if (this.state.isRightSliderFocused) {
      const offset = this.refs.body.getBoundingClientRect().left
      let newListWidth = e.pageX - offset
      if (newListWidth < 180) {
        newListWidth = 180
      } else if (newListWidth > 600) {
        newListWidth = 600
      }
      this.setState({
        listWidth: newListWidth
      })
    }
    if (this.state.isLeftSliderFocused) {
      let navWidth = e.pageX
      if (navWidth < 80) {
        navWidth = 80
      } else if (navWidth > 600) {
        navWidth = 600
      }
      this.setState({
        navWidth: navWidth
      })
    }
  }

  handleFullScreenButton(e) {
    this.setState({ fullScreen: !this.state.fullScreen }, () => {
      const noteDetail = document.querySelector('.NoteDetail')
      const noteList = document.querySelector('.NoteList')
      const mainBody = document.querySelector('#main-body')

      if (this.state.fullScreen) {
        this.hideLeftLists(noteDetail, noteList, mainBody)
      } else {
        this.showLeftLists(noteDetail, noteList, mainBody)
      }
    })
  }

  hideLeftLists(noteDetail, noteList, mainBody) {
    this.setState({ noteDetailWidth: noteDetail.style.left })
    this.setState({ mainBodyWidth: mainBody.style.left })
    noteDetail.style.left = '0px'
    mainBody.style.left = '0px'
    noteList.style.display = 'none'
  }

  showLeftLists(noteDetail, noteList, mainBody) {
    noteDetail.style.left = this.state.noteDetailWidth
    mainBody.style.left = this.state.mainBodyWidth
    noteList.style.display = 'inline'
  }

  render() {
    const { config } = this.props

    // the width of the navigation bar when it is folded/collapsed
    const foldedNavigationWidth = 44

    return (
      <div
        className='Main'
        styleName='root'
        onMouseMove={e => this.handleMouseMove(e)}
        onMouseUp={e => this.handleMouseUp(e)}
      >
        <SideNav
          {..._.pick(this.props, [
            'dispatch',
            'data',
            'config',
            'match',
            'location'
          ])}
          width={this.state.navWidth}
        />
        {!config.isSideNavFolded && (
          <div
            styleName={
              this.state.isLeftSliderFocused ? 'slider--active' : 'slider'
            }
            style={{ left: this.state.navWidth }}
            onMouseDown={e => this.handleLeftSlideMouseDown(e)}
            draggable='false'
          >
            <div styleName='slider-hitbox' />
          </div>
        )}
        <div
          styleName={config.isSideNavFolded ? 'body--expanded' : 'body'}
          id='main-body'
          ref='body'
          style={{
            left: config.isSideNavFolded
              ? foldedNavigationWidth
              : this.state.navWidth
          }}
        >
          <TopBar
            style={{ width: this.state.listWidth }}
            {..._.pick(this.props, [
              'dispatch',
              'config',
              'data',
              'match',
              'location'
            ])}
          />
          <NoteList
            style={{ width: this.state.listWidth }}
            {..._.pick(this.props, [
              'dispatch',
              'data',
              'config',
              'match',
              'location'
            ])}
          />
          <div
            styleName={
              this.state.isRightSliderFocused
                ? 'slider-right--active'
                : 'slider-right'
            }
            style={{ left: this.state.listWidth - 1 }}
            onMouseDown={e => this.handleRightSlideMouseDown(e)}
            draggable='false'
          >
            <div styleName='slider-hitbox' />
          </div>
          <Detail
            style={{ left: this.state.listWidth }}
            {..._.pick(this.props, [
              'dispatch',
              'data',
              'config',
              'match',
              'location'
            ])}
            ignorePreviewPointerEvents={this.state.isRightSliderFocused}
          />
        </div>
      </div>
    )
  }
}

Main.childContextTypes = {
  status: PropTypes.shape({
    updateReady: PropTypes.bool.isRequired
  }).isRequired,
  config: PropTypes.shape({}).isRequired
}

Main.propTypes = {
  dispatch: PropTypes.func,
  data: PropTypes.shape({}).isRequired
}

export default connect(x => x)(CSSModules(Main, styles))
