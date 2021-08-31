/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import * as dotenv from 'dotenv';
import { Uri, window } from "vscode";
import { AppSettingsTreeItem, confirmOverwriteSettings, IAppSettingsClient } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { envFileName } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import * as workspaceUtil from '../../utils/workspace';
import { getLocalEnvironmentVariables } from "./getLocalEnvironmentVariables";

export async function uploadAppSettings(context: IActionContext, target?: Uri | AppSettingsTreeItem | string | undefined): Promise<void> {
    context.telemetry.eventVersion = 2;
    let node: AppSettingsTreeItem | undefined;
    let envPath: string;
    if (typeof target === "string") {
        envPath = target;
    } else if (target instanceof Uri) {
        envPath = target.fsPath;
    } else {
        node = target;
        const message: string = localize('selectEnv', 'Select the local .env file to upload.');
        envPath = await workspaceUtil.selectWorkspaceFile(context, message, () => envFileName);
    }

    if (!node) {
        node = <AppSettingsTreeItem>await ext.tree.showTreeItemPicker(AppSettingsTreeItem.contextValue, context);
    }
    const client: IAppSettingsClient = await node.clientProvider.createClient(context);
    await node.runWithTemporaryDescription(context, localize('uploading', 'Uploading settings to "{0}"...', client.fullName), async () => {
        const localEnvVariables: dotenv.DotenvParseOutput = await getLocalEnvironmentVariables(context, envPath);
        if (Object.keys(localEnvVariables).length > 0) {
            const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
            if (!remoteSettings.properties) {
                remoteSettings.properties = {};
            }

            await confirmOverwriteSettings(context, localEnvVariables, remoteSettings.properties, client.fullName);
            await client.updateApplicationSettings(remoteSettings);
        } else {
            throw new Error(localize('noEnvFound', 'No environment variables found in "{0}".', envFileName));
        }
    });

    void window.showInformationMessage(localize('uploaded', 'Uploaded settings to "{0}".', client.fullName));
}
