
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const WebpackShellPlugin = require('webpack-shell-plugin')
const WatchExternalFilesPlugin = require('webpack-watch-files-plugin').default

module.exports = {
  module: {
    rules: []
  },

  devtool: 'source-map',

  mode: 'development',
  plugins: [
    new WebpackShellPlugin({
      onBuildStart: ['make -C sys'], dev: false, swallowError: true
    }),
    new HtmlWebpackPlugin({
      template: 'index.html'
    }),
    new CopyPlugin([
      { from: 'sys/sys.bin'            , to: 'sys.bin'     },
      { from: 'basic.bin'              , to: 'basic.bin'   },
      { from: 'C64_Pro_Mono-STYLE.ttf' , to: 'c64.ttf'     },
      { from: 'pointer.png'            , to: 'pointer.png' }
    ]),
    new WatchExternalFilesPlugin({
      files: ['./sys/sys.asm']
    })
  ],

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  
  node: {
    'fs': 'empty'
  }
}
