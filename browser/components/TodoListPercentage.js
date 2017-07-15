/**
 * @fileoverview Percentage of todo achievement.
 */

import React, { PropTypes } from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './TodoListPercentage.styl'

/**
 * @param {number} percentageOfTodo
 */

const TodoListPercentage = ({
  percentageOfTodo
}) => (
  <div styleName='percentageBar' style={{display: isNaN(percentageOfTodo) ? 'none' : ''}}>
    <div styleName='progressBar' style={{width: `${percentageOfTodo}%`}}>
      <p styleName='percentageText'>{percentageOfTodo}%</p>
    </div>
  </div>
)

TodoListPercentage.propTypes = {
  percentageOfTodo: PropTypes.number.isRequired
}

export default CSSModules(TodoListPercentage, styles)
