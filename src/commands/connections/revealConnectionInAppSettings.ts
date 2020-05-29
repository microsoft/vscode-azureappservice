/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { CosmosDBConnection } from '../../explorer/CosmosDBConnection';
import { ext } from "../../extensionVariables";

export async function revealConnectionInAppSettings(context: IActionContext, node?: CosmosDBConnection): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<CosmosDBConnection>(CosmosDBConnection.contextValue, { ...context, suppressCreatePick: true });
    }

    // Ideally this reveals all appSettingKeys, but for now just reveal the first one
    const firstKey: string = node.appSettingKeys[0];
    const nodeToReveal = await ext.tree.findTreeItem(`${node.parent.parent.parent.appSettingsNode.fullId}/${firstKey}`, context);
    if (!nodeToReveal) {
        throw new Error(`Failed to find app setting with key "${firstKey}".`);
    }
    await ext.treeView.reveal(nodeToReveal);
}
