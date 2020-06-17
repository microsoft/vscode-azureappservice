/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

const process = require('process');
const dev = require("vscode-azureextensiondev");

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
    /**
     *  The simple-git package was causing the following webpack error. This rule makes sure to use ts-loader to load the package.
     *
     * ERROR in ./node_modules/simple-git/src/lib/runners/promise.ts 71:28
     *  Module parse failed: Unexpected token(71:28)
     *  You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders
     *  | const { gitInstanceFactory } = require('../../git-factory');
     *  |
     *  > export function gitP(baseDir?: string): SimpleGit {
     *  |
     *  | let git: any;
     */

    loaderRules: [
        {
            test: /\.ts$/,
            include: /node_modules[\\\/]simple-git/,
            use: [{
                // Note: the TS loader will transpile the .ts file directly during webpack (i.e., webpack is directly pulling the .ts files, not .js files from out/)
                loader: require.resolve('ts-loader')
            }]
        }
    ]
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = config;
