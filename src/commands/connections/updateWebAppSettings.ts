/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem } from "vscode-azureappservice";

export async function updateWebAppSetting(appSettItem: AppSettingsTreeItem, appSettingToUpdate: string, value: string): Promise<void> {
    await appSettItem.editSettingItem(appSettingToUpdate, appSettingToUpdate, value);
    await appSettItem.refresh();
}
