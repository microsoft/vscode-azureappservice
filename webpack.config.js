/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

const process = require('process');
const dev = require("@microsoft/vscode-azext-dev");
<<<<<<< Updated upstream
=======
const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
>>>>>>> Stashed changes

let DEBUG_WEBPACK = !/^(false|0)?$/i.test(process.env.DEBUG_WEBPACK || '');

let config = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externals:
    {
        // Fix "Module not found" errors in ./node_modules/websocket/lib/{BufferUtil,Validation}.js
        // These files are not in node_modules and so will fail normally at runtime and instead use fallbacks.
        // Make them as external so webpack doesn't try to process them, and they'll simply fail at runtime as before.
        '../build/Release/validation': 'commonjs ../build/Release/validation',
        '../build/default/validation': 'commonjs ../build/default/validation',
        '../build/Release/bufferutil': 'commonjs ../build/Release/bufferutil',
        '../build/default/bufferutil': 'commonjs ../build/default/bufferutil',
    },
    target: 'node',
    suppressCleanDistFolder: true
});

let webConfig = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externals:
    {
        // Fix "Module not found" errors in ./node_modules/websocket/lib/{BufferUtil,Validation}.js
        // These files are not in node_modules and so will fail normally at runtime and instead use fallbacks.
        // Make them as external so webpack doesn't try to process them, and they'll simply fail at runtime as before.
        '../build/Release/validation': 'commonjs ../build/Release/validation',
        '../build/default/validation': 'commonjs ../build/default/validation',
        '../build/Release/bufferutil': 'commonjs ../build/Release/bufferutil',
        '../build/default/bufferutil': 'commonjs ../build/default/bufferutil',
    },
    target: 'webworker',
    entries: { polyfill: './src/polyfill.worker.ts', },
    plugins: [new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
        title: 'Storage Web Worker Sample',
    }),
    new NodePolyfillPlugin({
        includeAliases: [
            "path", "stream", "process", "Buffer"
        ]
    })],
    suppressCleanDistFolder: true,
    resolveFallbackAliases: {
        "timers": require.resolve("timers-browserify"),
        'constants': false,
        'tls': false,
        'bufferutil': false,
        'utf-8-validate': false
    }
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = config;
