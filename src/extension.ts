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
import { AzureSignIn, NotSignedInError } from "./azureSignIn";

var azureSignIn: AzureSignIn | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "azure-app-service-tools" is now active!');

    azureSignIn = new AzureSignIn(context);
    let appServiceDataProvider = new AppServiceDataProvider(azureSignIn);
    
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let refreshDisposable = vscode.commands.registerCommand('appService.Refresh', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        appServiceDataProvider.refresh();
    });

    let openInPortalDisposable = vscode.commands.registerCommand('appService.OpenInPortal', (...args: any[]) => {
        console.log(args);
    });

    let appServiceDataProviderDisposable = vscode.window.registerTreeDataProvider('azureAppService', appServiceDataProvider);
    
    context.subscriptions.push(refreshDisposable);
    context.subscriptions.push(appServiceDataProviderDisposable)
}

// this method is called when your extension is deactivated
export function deactivate() {
}