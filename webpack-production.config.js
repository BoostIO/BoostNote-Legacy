const skeleton = require('./webpack-skeleton')
const webpack = require('webpack')
const path = require('path')
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')

var config = Object.assign({}, skeleton, {
  module: {
    loaders: [
      {
        test: /pdf(\.worker)?(\.min)?\.js\.map$/,
        loader: 'raw-loader'
      },
      {
        test: /(\.js|\.jsx)?$/,
        exclude: [
          /(node_modules|bower_components)/,
          /pdf(\.worker)?(\.min)?\.js\.map$/
        ],
        loader: 'babel'
      },
      {
        test: /\.styl$/,
        exclude: /(node_modules|bower_components)/,
        loader:
          'style!css?modules&importLoaders=1&localIdentName=[name]__[local]___[path]!stylus?sourceMap'
      },
      {
        test: /\.json$/,
        loader: 'json'
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'compiled'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    sourceMapFilename: '[name].map',
    publicPath: 'http://localhost:8080/assets/'
  },
  plugins: [
    new webpack.NoErrorsPlugin(),
    new NodeTargetPlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        BABEL_ENV: JSON.stringify('production')
      }
    })
  ]
})

module.exports = config
