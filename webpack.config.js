const path = require('path');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {
    KNOWN_GAMES,
    resolveBuildFeatures,
    buildDefinePluginEntries,
} = require('./scripts/resolve-build-features');

function createConfig({
    name,
    entry,
    filename,
    features,
    mode,
    copyLocales,
}) {
    const config = {
        name,
        mode,
        entry,
        output: {
            filename,
            path: path.join(__dirname, 'dist'),
            // Runtime isolé : le script principal et chaque jeu cohabitent sur la page.
            uniqueName: name,
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
            new webpack.DefinePlugin(buildDefinePluginEntries(features)),
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
            // Pas de chunk partagé : chaque <script> doit s'exécuter seul.
            splitChunks: false,
            runtimeChunk: false,
            usedExports: true,
            sideEffects: true,
        },
        devtool: mode === 'development' ? 'eval-cheap-module-source-map' : undefined,
    };

    if (copyLocales) {
        config.plugins.push(new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'res/locales'),
                    to: 'kiwi-games/locales',
                },
            ],
        }));
        config.devServer = {
            static: path.join(__dirname, 'dist'),
            compress: true,
            port: 9002,
            hot: false,
            liveReload: false,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        };
    }

    return config;
}

module.exports = (env = {}, argv = {}) => {
    const mode = argv.mode || 'production';
    const features = resolveBuildFeatures(env);

    const configs = [
        createConfig({
            name: 'kiwi_games_shell',
            entry: './src/plugin.js',
            filename: 'plugin-kiwi-games.js',
            features,
            mode,
            copyLocales: true,
        }),
    ];

    KNOWN_GAMES.forEach((id) => {
        if (!features.games[id]) return;
        configs.push(createConfig({
            name: 'kiwi_game_' + id,
            entry: './src/games/' + id + '/boot.js',
            filename: 'kiwi-games/' + id + '.js',
            features,
            mode,
            copyLocales: false,
        }));
    });

    return configs;
};
