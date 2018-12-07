/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "azure-arm-website";
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, SiteClient } from "vscode-azureappservice";
import { envFileName } from "../../constants";
import { ext } from "../../extensionVariables";
import * as workspaceUtil from '../../utils/workspace';
import { confirmOverwriteSettings } from "./confirmOverwriteSettings";
import { getEnvironmentVariables, IEnvironmentVariables } from './getEnvironmentVariables';

export async function downloadAppSettings(node?: AppSettingsTreeItem): Promise<void> {
    if (!node) {
        node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue);
    }

    const client: SiteClient = node.root.client;

    const message: string = 'Select the destination file for your downloaded settings.';
    const envVarPath: string = await workspaceUtil.selectWorkspaceFile(ext.ui, message, () => envFileName);
    const envVarUri: vscode.Uri = vscode.Uri.file(envVarPath);

    await node.runWithTemporaryDescription('Downloading...', async () => {
        ext.outputChannel.appendLine(`Downloading settings from "${client.fullName}"...`);
        const localSettings: IEnvironmentVariables = await getEnvironmentVariables(envVarPath, true /* allowOverwrite */);

        if (!localSettings.Values) {
            localSettings.Values = {};
        }

        const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
        if (remoteSettings.properties) {
            await confirmOverwriteSettings(remoteSettings.properties, localSettings.Values, envFileName);
        }

        await fse.ensureFile(envVarPath);
        await fse.writeJson(envVarPath, localSettings, { spaces: 2 });
    });

    const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(envVarUri);
    await vscode.window.showTextDocument(doc);
}
