/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem } from "vscode-azureappservice";
import { ext } from "../../extensionVariables";

export async function updateWebAppSetting(webAppId: string, appSettingToUpdate: string, value: string): Promise<void> {
    const appSettItem = <AppSettingsTreeItem | undefined>await ext.tree.findTreeItem(webAppId + String('/application'));
    if (!appSettItem) {
        throw new Error(`Couldn't find the application settings for web app with provided Id: ${webAppId}`);
    }
    await appSettItem.editSettingItem(appSettingToUpdate, appSettingToUpdate, value);
    await appSettItem.refresh();
}
