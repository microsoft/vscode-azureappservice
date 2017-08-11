/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AzureLogin, AzureAccount } from './azurelogin.api';
import { AppServiceDataProvider, AppServiceNode } from './appServiceExplorer';
import { AzureSignIn, NotSignedInError } from './azureSignIn';

var azureSignIn: AzureSignIn | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "azure-app-service-tools" is now active!');

    azureSignIn = new AzureSignIn(context);
    let appServiceDataProvider = new AppServiceDataProvider(azureSignIn);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', appServiceDataProvider));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Refresh', () => {
        appServiceDataProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Browse', (...args: any[]) => {
        if (args.length === 0 || !(args[0] instanceof AppServiceNode)) {
            return;
        }
        (<AppServiceNode>args[0]).browse();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.OpenInPortal', (...args: any[]) => {
        if (args.length === 0 || !(args[0] instanceof AppServiceNode)) {
            return;
        }
        (<AppServiceNode>args[0]).openInPortal(azureSignIn);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Start', (...args: any[]) => {
        console.log(args);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('appService.Stop', (...args: any[]) => {
        console.log(args);
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
    azureSignIn = null;
}
