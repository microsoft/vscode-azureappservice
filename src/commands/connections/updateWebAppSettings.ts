/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebAppTreeItem } from "src/explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function updateWebAppSetting(webAppId: string, appSettingToUpdate: string, value: string): Promise<void> {
    const webApp = <WebAppTreeItem | undefined>await ext.tree.findTreeItem(webAppId);
    if (!webApp) {
        throw new Error(`Couldn't find the web app with provided Id: ${webAppId}`);
    }
    const appSettItem = webApp.appSettingsNode;
    await appSettItem.editSettingItem(appSettingToUpdate, appSettingToUpdate, value);
    await appSettItem.refresh();
}
