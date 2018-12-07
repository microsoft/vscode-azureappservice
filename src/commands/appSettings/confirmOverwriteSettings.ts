/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DialogResponses } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";

export async function confirmOverwriteSettings(sourceSettings: { [key: string]: string }, destinationSettings: { [key: string]: string }, destinationName: string): Promise<void> {
    let suppressPrompt: boolean = false;
    let overwriteSetting: boolean = false;

    const addedKeys: string[] = [];
    const updatedKeys: string[] = [];
    const userIgnoredKeys: string[] = [];
    const matchingKeys: string[] = [];

    for (const key of Object.keys(sourceSettings)) {
        if (destinationSettings[key] === undefined) {
            addedKeys.push(key);
            destinationSettings[key] = sourceSettings[key];
        } else if (destinationSettings[key] !== sourceSettings[key]) {
            if (!suppressPrompt) {
                const yesToAll: vscode.MessageItem = { title: 'Yes to all' };
                const noToAll: vscode.MessageItem = { title: 'No to all' };
                const message: string = `Setting "${key}" already exists in "${destinationName}". Overwrite?`;
                const result: vscode.MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.yes, yesToAll, DialogResponses.no, noToAll);
                if (result === DialogResponses.yes) {
                    overwriteSetting = true;
                } else if (result === yesToAll) {
                    overwriteSetting = true;
                    suppressPrompt = true;
                } else if (result === DialogResponses.no) {
                    overwriteSetting = false;
                } else if (result === noToAll) {
                    overwriteSetting = false;
                    suppressPrompt = true;
                }
            }

            if (overwriteSetting) {
                updatedKeys.push(key);
                destinationSettings[key] = sourceSettings[key];
            } else {
                userIgnoredKeys.push(key);
            }
        } else {
            matchingKeys.push(key);
        }
    }

    if (addedKeys.length > 0) {
        ext.outputChannel.appendLine('Added the following settings:');
        addedKeys.forEach(logKey);
    }

    if (updatedKeys.length > 0) {
        ext.outputChannel.appendLine('Updated the following settings:');
        updatedKeys.forEach(logKey);
    }

    if (matchingKeys.length > 0) {
        ext.outputChannel.appendLine('Ignored the following settings that were already the same:');
        matchingKeys.forEach(logKey);
    }

    if (userIgnoredKeys.length > 0) {
        ext.outputChannel.appendLine('Ignored the following settings based on user input:');
        userIgnoredKeys.forEach(logKey);
    }

    if (Object.keys(destinationSettings).length > Object.keys(sourceSettings).length) {
        ext.outputChannel.appendLine(`WARNING: This operation will not delete any settings in "${destinationName}". You must manually delete settings if desired.`);
    }
}

function logKey(key: string): void {
    ext.outputChannel.appendLine(`- ${key}`);
}
