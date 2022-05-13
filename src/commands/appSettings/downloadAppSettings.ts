/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "@azure/arm-appservice";
import { AppSettingsTreeItem, confirmOverwriteSettings, IAppSettingsClient } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext, UserCancelledError } from "@microsoft/vscode-azext-utils";
import { DotenvParseOutput } from "dotenv";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as vscode from 'vscode';
import { window } from "vscode";
import { envFileName, webAppFilter } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import * as workspaceUtil from '../../utils/workspace';
import { getLocalEnvironmentVariables } from './getLocalEnvironmentVariables';

export async function downloadAppSettings(context: IActionContext, node?: AppSettingsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<AppSettingsTreeItem>(context, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(AppSettingsTreeItem.contextValue)
        });
    }

    const client: IAppSettingsClient = await node.clientProvider.createClient(context);

    const message: string = localize('selectDest', 'Select the destination file for your downloaded settings.');
    const envVarPath: string = await workspaceUtil.selectWorkspaceFile(context, message, () => envFileName);
    const envVarUri: vscode.Uri = vscode.Uri.file(envVarPath);

    await node.runWithTemporaryDescription(context, localize('downloading', 'Downloading...'), async () => {
        ext.outputChannel.appendLog(localize('downloadingSettings', 'Downloading settings from "{0}"...', client.fullName));
        const localEnvVariables: DotenvParseOutput = await getLocalEnvironmentVariables(context, envVarPath, true /* allowOverwrite */);
        const remoteEnvVariables: StringDictionary = await client.listApplicationSettings();
        if (remoteEnvVariables.properties) {
            await confirmOverwriteSettings(context, remoteEnvVariables.properties, localEnvVariables, envFileName);
        }

        await fse.ensureFile(envVarPath);
        await fse.writeFile(envVarPath, convertAppSettingsToEnvVariables(localEnvVariables, client.fullName));
    });

    void window.showInformationMessage(localize('Settings', 'Downloaded settings from "{0}".  View settings file?', client.fullName), localize('view', 'View file')).then(async (input) => {
        if (!input) {
            throw new UserCancelledError();
        }
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(envVarUri);
        await vscode.window.showTextDocument(doc);
    });
}

export function convertAppSettingsToEnvVariables(appSettings: { [propertyName: string]: string }, appName: string): string {
    let envData: string = localize('envComment', '# Downloaded Application Settings from "{0}"{1}', appName, os.EOL);
    for (const property of Object.keys(appSettings)) {
        envData += `${property}="${appSettings[property]}"`;
        envData += os.EOL;
    }
    return envData;
}
