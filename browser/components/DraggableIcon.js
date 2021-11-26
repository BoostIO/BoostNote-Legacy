import React from 'react'
import { SortableHandle } from 'react-sortable-hoc'

const DraggableIcon = SortableHandle(({ className }) => (
  <i className={`fa ${className}`} />
))

export default DraggableIcon
