const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebPackPlugin = require("copy-webpack-plugin");
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const WebExtPlugin = require('web-ext-plugin');

/* fx-runner curently doesn't support NetBSD correctly. We need to
 * manually find the executable of firefox. */
const firefoxBin = (() => {
    const os = require('os');
    if (/netbsd/i.test(os.platform())) {
        const which = require('which');
        return which.sync('firefox');
    }
    else {
        return 'firefox';
    }
})();

module.exports = {
    mode: 'none',
    entry: {
        background: './src/background.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist')
    },
    devtool: "inline-source-map", // Enable sourcemaps for debugging webpack's output.
    resolve: {
        extensions: [".ts", ".js"]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebPackPlugin({
            patterns: [
                { from: "assets", to: "assets" }
            ]
        }),
        new WebpackExtensionManifestPlugin({
            config: 'src/baseManifest.js',
            pkgJsonProps: [
                'version',
                'description',
            ]
        }),
        new WebExtPlugin({
            sourceDir: path.resolve(__dirname, 'dist'),
            browserConsole: true,
            firefox: firefoxBin
        })
    ],
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' }
        ]
    }
};
