const path = require('path');

module.exports = {
  entry: './src/firebase-extension-bundle.js',
  output: {
    filename: 'firebase-bundle.js',
    path: path.resolve(__dirname, 'extension/vendor/firebase/'),
    clean: true,
  },
  mode: 'production',
  target: 'web',
  resolve: {
    fallback: {
      "buffer": false,
      "crypto": false,
      "stream": false,
      "util": false,
      "assert": false,
      "http": false,
      "https": false,
      "os": false,
      "url": false,
      "fs": false,
      "path": false
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  optimization: {
    minimize: true,
  }
}; 