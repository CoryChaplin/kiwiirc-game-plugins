const path = require('path');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const TerserPlugin = require('terser-webpack-plugin');
const makeSourceMap = process.argv.indexOf('--srcmap') > -1;

module.exports = (env, argv) => {
  const mode = argv.mode || 'production';

  return {
    mode,
    entry: {
      'plugin-pictionary': './src/plugin.js',
    },
    output: {
      filename: '[name].js',
      path: path.join(__dirname, 'dist'),
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
        },
        {
          test: /\.js$/,
          use: [{ loader: 'babel-loader' }],
          include: [path.join(__dirname, 'src'), path.join(__dirname, 'dev')],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new VueLoaderPlugin(),
      new webpack.ProvidePlugin({
        kiwi: path.resolve(__dirname, 'src/kiwi-runtime.js'),
      }),
    ],
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
    optimization: {
      minimize: mode === 'production',
      minimizer:
        mode === 'production'
          ? [
              new TerserPlugin({
                extractComments: false,
              }),
            ]
          : [],
    },
    devtool: makeSourceMap ? 'source-map' : mode === 'development' ? 'eval-cheap-module-source-map' : undefined,
    devServer: {
      static: [
        path.join(__dirname, 'dist'),
        { directory: path.join(__dirname, 'dev'), publicPath: '/' },
      ],
      compress: true,
      port: 9001,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
};
