/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { webAppFilter } from '../../constants';
import { ext } from "../../extensionVariables";
import { localize } from '../../localize';
import { CosmosDBConnection } from '../../tree/CosmosDBConnection';

export async function revealConnectionInAppSettings(context: IActionContext, node?: CosmosDBConnection): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<CosmosDBConnection>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: CosmosDBConnection.contextValue
        });
    }

    // Ideally this reveals all appSettingKeys, but for now just reveal the first one
    const firstKey: string = node.appSettingKeys[0];
    const nodeToReveal: AzExtTreeItem | undefined = await ext.rgApi.tree.findTreeItem(`${node.parent.parent.appSettingsNode.fullId}/${firstKey}`, context);
    if (!nodeToReveal) {
        throw new Error(localize('revealFailed', 'Failed to find app setting with key "{0}".', firstKey));
    }
    await ext.rgApi.treeView.reveal(nodeToReveal);
}
