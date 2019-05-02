/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "azure-arm-website";
import { DotenvParseOutput } from "dotenv";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as vscode from 'vscode';
import { window } from "vscode";
import { AppSettingsTreeItem, confirmOverwriteSettings, SiteClient } from "vscode-azureappservice";
import { UserCancelledError } from "vscode-azureextensionui";
import { envFileName } from "../../constants";
import { ext } from "../../extensionVariables";
import * as workspaceUtil from '../../utils/workspace';
import { getLocalEnvironmentVariables } from './getLocalEnvironmentVariables';

export async function downloadAppSettings(node?: AppSettingsTreeItem): Promise<void> {
    if (!node) {
        node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue);
    }

    const client: SiteClient = node.root.client;

    const message: string = 'Select the destination file for your downloaded settings.';
    const envVarPath: string = await workspaceUtil.selectWorkspaceFile(message, () => envFileName);
    const envVarUri: vscode.Uri = vscode.Uri.file(envVarPath);

    await node.runWithTemporaryDescription('Downloading...', async () => {
        ext.outputChannel.appendLine(`Downloading settings from "${client.fullName}"...`);
        const localEnvVariables: DotenvParseOutput = await getLocalEnvironmentVariables(envVarPath, true /* allowOverwrite */);
        const remoteEnvVariables: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
        if (remoteEnvVariables.properties) {
            await confirmOverwriteSettings(remoteEnvVariables.properties, localEnvVariables, envFileName);
        }

        await fse.ensureFile(envVarPath);
        await fse.writeFile(envVarPath, convertAppSettingsToEnvVariables(localEnvVariables, client.fullName));
    });

    window.showInformationMessage(`Downloaded settings from "${client.fullName}".  View settings file?`, 'View file').then(async (input) => {
        if (!input) {
            throw new UserCancelledError();
        }
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(envVarUri);
        await vscode.window.showTextDocument(doc);
    });
}

export function convertAppSettingsToEnvVariables(appSettings: { [propertyName: string]: string }, appName: string): string {
    let envData: string = `# Downloaded Application Settings from "${appName}"${os.EOL}`;
    for (const property of Object.keys(appSettings)) {
        envData += `${property}="${appSettings[property]}"`;
        envData += os.EOL;
    }
    return envData;
}
