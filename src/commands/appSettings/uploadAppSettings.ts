/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "azure-arm-website";
import * as dotenv from 'dotenv';
import { Uri, window } from "vscode";
import { AppSettingsTreeItem, confirmOverwriteSettings, SiteClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { envFileName } from "../../constants";
import { ext } from "../../extensionVariables";
import * as workspaceUtil from '../../utils/workspace';
import { getLocalEnvironmentVariables } from "./getLocalEnvironmentVariables";

export async function uploadAppSettings(context: IActionContext, target?: Uri | AppSettingsTreeItem | undefined): Promise<void> {
    let node: AppSettingsTreeItem | undefined;
    let envPath: string;
    if (target instanceof Uri) {
        envPath = target.fsPath;
    } else {
        node = target;
        const message: string = 'Select the local .env file to upload.';
        envPath = await workspaceUtil.selectWorkspaceFile(message, () => envFileName);
    }

    if (!node) {
        node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue, context);
    }
    const client: SiteClient = node.root.client;
    await node.runWithTemporaryDescription(`Uploading settings to "${client.fullName}"...`, async () => {
        const localEnvVariables: dotenv.DotenvParseOutput = await getLocalEnvironmentVariables(envPath);
        if (Object.keys(localEnvVariables).length > 0) {
            const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
            if (!remoteSettings.properties) {
                remoteSettings.properties = {};
            }

            await confirmOverwriteSettings(localEnvVariables, remoteSettings.properties, client.fullName);
            await client.updateApplicationSettings(remoteSettings);
        } else {
            throw new Error(`No enviroment variables found in "${envFileName}".`);
        }
    });

    // tslint:disable-next-line: no-floating-promises
    window.showInformationMessage(`Uploaded settings to "${client.fullName}".`);
}
