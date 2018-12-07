/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fse from 'fs-extra';
import { MessageItem } from 'vscode';
import { DialogResponses, parseError } from 'vscode-azureextensionui';
import { ext } from "../../extensionVariables";

export interface ILocalAppSettings {
    IsEncrypted?: boolean;
    Values?: { [key: string]: string };
    ConnectionStrings?: { [key: string]: string };
}

export async function getLocalSettings(localSettingsPath: string, allowOverwrite: boolean = false): Promise<ILocalAppSettings> {
    if (await fse.pathExists(localSettingsPath)) {
        const data: string = (await fse.readFile(localSettingsPath)).toString();
        if (/[^\s]/.test(data)) {
            try {
                return <ILocalAppSettings>JSON.parse(data);
            } catch (error) {
                if (allowOverwrite) {
                    const message: string = `Failed to parse local settings: ${parseError(error).message}. Overwrite?`);
                    const overwriteButton: MessageItem = { title: 'Overwrite' };
                    // Overwrite is the only button and cancel automatically throws, so no need to check result
                    await ext.ui.showWarningMessage(message, { modal: true }, overwriteButton, DialogResponses.cancel);
                } else {
                    throw error;
                }
            }
        }
    }

    return {
        IsEncrypted: false,
        Values: {}
    };
}
