import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './PreviewSearch.styl'
import ee from 'browser/main/lib/eventEmitter'

class PreviewSearch extends React.Component {
  constructor(props) {
    super(props)
    this.handleSearch = this.handleSearch.bind(this)
    this.handleSearchChange = this.handleSearchChange.bind(this)
    this.keyDownHandler = e => this.handleKeyDown(e)
    this.state = {
      value: ''
    }
  }

  handleKeyDown(e) {
    if (e.keyCode === 13) {
      this.handleSearch('forward')()
    }
  }

  handleSearch(direction) {
    return () => {
      ee.emit('preview:search', {
        value: this.state.value,
        direction: direction
      })
    }
  }

  handleSearchChange(e) {
    this.setState({ value: e.target.value })
  }

  render() {
    return (
      <div styleName='preview-search'>
        <div styleName='icon'>
          <i className='fa fa-search' />
        </div>
        <input
          styleName='search-box'
          onKeyDown={this.keyDownHandler}
          value={this.state.value}
          onChange={this.handleSearchChange}
          placeholder='search...'
        />
        <button styleName='icon' onClick={this.handleSearch('backward')}>
          <i className='fa fa-chevron-up' />
        </button>
        <button styleName='icon' onClick={this.handleSearch('forward')}>
          <i className='fa fa-chevron-down' />
        </button>
      </div>
    )
  }
}

export default CSSModules(PreviewSearch, styles)
