const path = require('path');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const mode = (argv && argv.mode) || 'production';

    return {
        mode,
        entry: './src/plugin.js',
        output: {
            filename: 'plugin-kiwi-games.js',
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
                    include: [
                        path.join(__dirname, 'src'),
                    ],
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
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'res/locales'),
                        to: 'kiwi-games/locales',
                    },
                ],
            }),
        ],
        performance: {
            hints: false,
            maxEntrypointSize: 1024000,
            maxAssetSize: 1024000,
        },
        optimization: {
            minimize: mode === 'production',
            minimizer: mode === 'production'
                ? [new TerserPlugin({ extractComments: false })]
                : [],
        },
        devtool: mode === 'development' ? 'eval-cheap-module-source-map' : undefined,
        devServer: {
            static: path.join(__dirname, 'dist'),
            compress: true,
            port: 9002,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        },
    };
};
