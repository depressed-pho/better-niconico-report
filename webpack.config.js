const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebPackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
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
        background: "./src/background.ts",
        report: {
            import: "./src/pages/report/report.ts",
            filename: "assets/pages/[name]/[name].js"
        }
    },
    output: {
        path: path.resolve(__dirname, 'dist')
    },
    devtool: "inline-source-map", // Enable sourcemaps for debugging webpack's output.
    resolve: {
        extensions: [".ts", ".js"],
        alias: {
            'nicovideo': path.resolve(__dirname, 'lib')
        }
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebPackPlugin({
            patterns: [
                { from: "assets", to: "assets" },
                {
                    from: "src/pages",
                    to: "assets/pages",
                    filter: async (path) => {
                        return /\.html$/.test(path);
                    }
                },
            ]
        }),
        new MiniCssExtractPlugin({
            filename: "assets/pages/[name]/[name].css"
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
            browserConsole: false,
            firefox: firefoxBin
        })
    ],
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' },
            {
                test: /\.(sa|sc|c)ss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "postcss-loader",
                    "sass-loader"
                ]
            }
        ]
    }
};
