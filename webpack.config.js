const pkg = require("./package.json");
const path = require("path");
const { merge } = require('webpack-merge');
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebPackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WebpackExtensionManifestPlugin = require("webpack-extension-manifest-plugin");
const WebExtPlugin = require("web-ext-plugin");

/* fx-runner curently doesn't support NetBSD correctly. We need to
 * manually find the executable of firefox. */
const firefoxBin = (() => {
    const os = require("os");
    if (/netbsd/i.test(os.platform())) {
        const which = require("which");
        return which.sync("firefox");
    }
    else {
        return "firefox";
    }
})();

/* The default watching stops working very often on NetBSD. Until I
 * find out the cause, fall back to polling. */
const poll = (() => {
    const os = require("os");
    if (/netbsd/i.test(os.platform())) {
        return 500;
    }
    else {
        return false;
    }
})();

module.exports = (env, argv) => {
    const prod = {
        mode: "production",
        devtool: "source-map",
        optimization: {
            usedExports: true // See https://webpack.js.org/guides/tree-shaking/
        }
    };
    const dev = {
        mode: "development",
        /* We can't use eval-cheap-module-source-map because eval() is
         * prohibited by default as a CSP restriction. We also don't
         * want to loosen the CSP just for this. */
        devtool: "cheap-module-source-map",
        watchOptions: {
            // Ignore Emacs auto-save files.
            ignored: ['**/.#*', '**/#*'],
            poll
        }
    };
    const common = {
        entry: {
            background: "./src/background.ts",
            config: {
                import: "./src/pages/config/config.ts",
                filename: "assets/pages/[name]/[name].js"
            },
            report: {
                import: "./src/pages/report/report.ts",
                filename: "assets/pages/[name]/[name].js"
            }
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            assetModuleFilename: "assets/[name][ext]"
        },
        resolve: {
            extensions: [".ts", ".js"],
            alias: {
                'nicovideo': path.resolve(__dirname, 'lib'),
                'assets': path.resolve(__dirname, 'assets')
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
                buildPackage: true,
                outputFilename: `${pkg.name}-${pkg.version}.zip`,
                sourceDir: path.resolve(__dirname, "dist"),
                browserConsole: false,
                firefox: firefoxBin
            })
        ],
        module: {
            rules: [
                { test: /\.tsx?$/, loader: 'ts-loader' },
                {
                    test: /\.(eot|svg|ttf|woff2?)$/i,
                    type: 'asset/resource'
                },
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        "css-loader",
                        "postcss-loader",
                        "sass-loader"
                    ]
                },
                {
                    test: /\.html$/i,
                    use: [
                        {
                            loader: "html-loader",
                            options: {
                                esModule: true
                            }
                        }
                    ]
                }
            ]
        }
    };
    switch (argv.mode) {
    case "development":
        return merge(common, dev);

    case "production":
        return merge(common, prod);

    default:
        throw new Error("Unknown mode: " + argv.mode);
    }
};
