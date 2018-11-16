/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBConnection } from '../../explorer/CosmosDBConnection';
import { ext } from "../../extensionVariables";

export async function revealConnectionInAppSettings(node: CosmosDBConnection): Promise<void> {
    // Ideally this reveals all appSettingKeys, but for now just reveal the first one
    const firstKey: string = node.appSettingKeys[0];
    const nodeToReveal = await ext.tree.findTreeItem(`${node.parent.parent.parent.appSettingsNode.fullId}/${firstKey}`);
    if (!nodeToReveal) {
        throw new Error(`Failed to find app setting with key "${firstKey}".`);
    }
    await ext.treeView.reveal(nodeToReveal);
}
