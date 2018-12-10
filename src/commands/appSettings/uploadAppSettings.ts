/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "azure-arm-website";
import * as dotenv from 'dotenv';
import { AppSettingsTreeItem, SiteClient } from "vscode-azureappservice";
import { envFileName } from "../../constants";
import { ext } from "../../extensionVariables";
import * as workspaceUtil from '../../utils/workspace';
import { confirmOverwriteSettings } from "./confirmOverwriteSettings";

export async function uploadAppSettings(node?: AppSettingsTreeItem): Promise<void> {
    const message: string = 'Select the local settings file to upload.';
    const envPath: string = await workspaceUtil.selectWorkspaceFile(ext.ui, message, () => envFileName);

    if (!node) {
        node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue);
    }

    const client: SiteClient = node.root.client;

    await node.runWithTemporaryDescription('Uploading...', async () => {
        ext.outputChannel.appendLine(`Uploading settings to "${client.fullName}"...`);
        const env: dotenv.DotenvParseOutput = await dotenv.parse(envPath);
        if (env) {
            const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
            if (!remoteSettings.properties) {
                remoteSettings.properties = {};
            }

            await confirmOverwriteSettings(env, remoteSettings.properties, client.fullName);

            await client.updateApplicationSettings(remoteSettings);
        } else {
            throw new Error(`No settings found in "${envFileName}".`);
        }
    });
}
