/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CosmosDBConnection } from '../../explorer/CosmosDBConnection';
import { ext } from "../../extensionVariables";

export async function revealConnectionInAppSettings(node: CosmosDBConnection): Promise<void> {
    const nodeToReveal = await ext.tree.findTreeItem(`${node.parent.parent.parent.appSettingsNode.fullId}/${node.appSettingKey}`);
    if (nodeToReveal) {
        await ext.treeView.reveal(nodeToReveal);
    }
}
