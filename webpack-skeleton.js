const webpack = require('webpack')
const path = require('path')
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')

var config = {
  entry: {
    main: './browser/main/index.js',
    finder: './browser/finder/index.js'
  },
  resolve: {
    extensions: ['', '.js', '.jsx', '.styl'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
    alias: {
      'lib': path.join(__dirname, 'lib'),
      'browser': path.join(__dirname, 'browser')
    }
  },
  plugins: [
    new webpack.NoErrorsPlugin(),
    new NodeTargetPlugin()
  ],
  stylus: {
    use: [require('nib')()],
    import: [
      '~nib/lib/nib/index.styl',
      path.join(__dirname, 'browser/styles/index.styl')
    ]
  },
  externals: [
    'node-ipc',
    'electron',
    'md5',
    'superagent',
    'superagent-promise',
    'lodash',
    'markdown-it',
    'moment',
    'markdown-it-emoji',
    'fs-jetpack',
    '@rokt33r/markdown-it-math',
    'markdown-it-checkbox',
    'markdown-it-kbd',
    'devtron',
    'mixpanel',
    '@rokt33r/season',
    'markdown-pdf',
    {
      react: 'var React',
      'react-dom': 'var ReactDOM',
      'react-redux': 'var ReactRedux',
      'codemirror': 'var CodeMirror',
      'redux': 'var Redux',
      'raphael': 'var Raphael',
      'flowchart': 'var flowchart',
      'sequence-diagram': 'var Diagram'
    }
  ]
}

module.exports = config

