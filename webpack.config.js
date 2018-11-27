/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

// Full webpack documentation: [https://webpack.js.org/configuration/]().
// Using webpack helps reduce the install- and startup-time of large extensions because instead of hundreds of files, a single file is produced.

// How to fix "dynamic require", "Module not found", "the request of a dependency is an expression" etc. webpack errors:
//
//   Webpack works by parsing all .ts/.js code, finding 'require' and 'import', and sucking in the target files directly
//   into the bundle. At runtime, the modified require/import looks into webpack's list of bundled modules.
//   Since this happens at compile time, if the module can't be found or the argument to require is an expression, this
//   causes problems (an error when webpacking and an exception at runtime).
//
//   These are common ways of fixing the problem:
//
//   1) Ask the source author to make the code webpack-friendly.
//
//     E.g. by removing the use of require for loading JSON files (see https://github.com/Microsoft/vscode-nls/commit/3ec7623fd86fc5e38895fe1ac594d2564bb2b755#diff-8cfead41d88ad47d44509a8ab0a109ad).
//     This is not always possible or feasible.
//
//   1) ContextReplacementPlugin - the most confusing (https://iamakulov.com/notes/webpack-contextreplacementplugin/)
//
//     This is used when the target module does exist but webpack can't determine a static path at compile time because
//     it contains an expression (e.g. require(`./languages/${lang}`)).
//
//   2) StringReplacePlugin (https://github.com/jamesandersen/string-replace-webpack-plugin)
//
//     Allows you to do regex replacement of the source code make it webpack-friendly before webpack processes the file
//
//   3) ExternalNodeModules
//
//     Add a Node.js module name to the externalModules variable in order to have the entire module excluded from being bundled.
//     It will instead be copied to ./dist/node_modules and picked up there through normal Node.js import/require mechanisms. Since
//     it will not be processed by webpack and has no access to webpack's set of bundled modules, all dependencies of this module
//     also have to be (automatically) excluded, so use sparingly.

'use strict';

const process = require('process');
const webpack = require('webpack');
const StringReplacePlugin = require("string-replace-webpack-plugin");
const dev = require("vscode-azureextensiondev");

let DEBUG_WEBPACK = !!process.env.DEBUG_WEBPACK;

let config = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'normal' : 'debug',
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
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = config;
