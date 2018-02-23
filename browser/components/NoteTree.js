/**
 * @fileoverview Note item component with simple display mode.
 */
import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './NoteTree.styl'
import NoteItemSimple from 'browser/components/NoteItemSimple'
import getNoteKey from 'browser/main/NoteList'
import { store } from 'browser/main/store.js'
import { connect, Provider} from 'react-redux'
import { Subscription } from 'rx'

/**
 * @description Note item component when using simple display mode.
 * @param {boolean} isActive
 * @param {Object} noteTreeData
 * @param {Function} handleNoteClick
 * @param {Function} handleNoteContextMenu
 * @param {Function} handleDragStart
 */


class NoteTree extends React.Component {
  constructor () {
    super()
  }

  handleToggleButtonClick (path) {
    this.props.handleToggleButtonClick && this.props.handleToggleButtonClick(path);
  }

  render () {
    const subTree = this.props.children
    const fullpath = this.props.fullpath
    const subTreeDisplay = (Array.isArray(subTree)) ? 
      subTree.map(note =>  {
        // const uniqueKey = getNoteKey(note)
        return ( 
            // <NoteItemSimple
            //     isActive={isActive}
            //     note={note}
            //     key={uniqueKey}
            //     handleNoteContextMenu={this.handleNoteContextMenu.bind(this)}
            //     handleNoteClick={this.handleNoteClick.bind(this)}
            //     handleDragStart={this.handleDragStart.bind(this)}
            //     pathname={location.pathname}
            //   />
        <li>{note.title}</li>
      )
      })
    : Object.keys(subTree).map(k => {
        const newPath = this.props.fullpath + '/' + k
        return (
          <NoteTree className='NoteTree'
          label={k} 
          children={subTree[k]}
          fullpath={newPath}
          handleToggleButtonClick={this.props.handleToggleButtonClick}
          isOpen={this.props.isOpen}
          />
        )
        })
        
    const isOpen = this.props.isOpen.get(fullpath)
    return (
      <ol className='NoteTree' styleName='tree'>
          <button className={styles['toggleButton']}
                onMouseDown={e => { return this.props.handleToggleButtonClick(fullpath) }}
              >
                <img src={ isOpen
                  ? '../resources/icon/icon-down.svg'
                  : '../resources/icon/icon-right.svg'
                  }
                />
          </button>
                { this.props.label}
        { isOpen && subTreeDisplay}
      </ol>
    )
  }
}
const actionToggleOpen =  path => ({type:'TOGGLE_TREE', path})
const mapStateToProps = state => ({ 
  isOpen: state.data.treeVisibilityMap,
});
const mapDispatchToProps = dispatch => {
  return { 
    handleToggleButtonClick: path => dispatch(actionToggleOpen(path)) 
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CSSModules(NoteTree,styles));