/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dotenv from 'dotenv';
import * as fse from 'fs-extra';
import { MessageItem } from 'vscode';
import { IActionContext, parseError } from 'vscode-azureextensionui';
import { localize } from '../../localize';

export async function getLocalEnvironmentVariables(context: IActionContext, localSettingsPath: string, allowOverwrite: boolean = false): Promise<dotenv.DotenvParseOutput> {
    if (await fse.pathExists(localSettingsPath)) {
        const data: string = (await fse.readFile(localSettingsPath)).toString();
        try {
            return dotenv.parse(data);
        } catch (error) {
            if (allowOverwrite) {
                const message: string = localize('parseFailed', 'Failed to parse local environment: {0}. Overwrite?', parseError(error).message);
                const overwriteButton: MessageItem = { title: localize('overwrite', 'Overwrite') };
                // Overwrite is the only button and cancel automatically throws, so no need to check result
                await context.ui.showWarningMessage(message, { modal: true }, overwriteButton);
            } else {
                throw error;
            }
        }
    }
    return {};
}
