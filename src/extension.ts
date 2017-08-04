/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AzureLogin, AzureAccount } from './azurelogin.api';
import { AppServiceDataProvider } from "./appServiceExplorer";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "azure-app-service-tools" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });

    let appServiceDataProvider = new AppServiceDataProvider(context);
    let appServiceDataProviderDisposable = vscode.window.registerTreeDataProvider('azureAppService', appServiceDataProvider);
    
    context.subscriptions.push(disposable);
    context.subscriptions.push(appServiceDataProviderDisposable)
}

// this method is called when your extension is deactivated
export function deactivate() {
}