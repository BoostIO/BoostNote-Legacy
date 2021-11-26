import React from 'react'
import PropTypes from 'prop-types'

class Handle extends React.Component {
  render() {
    const { isHeader, styles } = this.props
    return (
      <div
        className={
          styles[isHeader ? 'header-drag-handle' : 'folderItem-drag-handle']
        }
      >
        <i className='fa fa-reorder' />
      </div>
    )
  }
}

Handle.propTypes = {
  isHeader: PropTypes.bool.isRequired
}

export default Handle
