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
    },
    output: {
        path: path.resolve(__dirname, 'dist')
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
            firefox: firefoxBin
        })
    ]
};
