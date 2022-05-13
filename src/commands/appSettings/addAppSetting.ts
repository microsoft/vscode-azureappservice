/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingsTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { webAppFilter } from "../../constants";
import { ext } from "../../extensionVariables";

export async function addAppSetting(context: IActionContext, node?: AppSettingsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<AppSettingsTreeItem>(context, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(AppSettingsTreeItem.contextValue)
        });
    }

    await node.createChild(context);
}
