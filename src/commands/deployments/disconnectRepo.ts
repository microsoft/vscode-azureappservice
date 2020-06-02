/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, disconnectRepo as disconnectRepository } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from "../../extensionVariables";
import { localize } from '../../localize';

export async function disconnectRepo(context: IActionContext, node?: DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<DeploymentsTreeItem>(DeploymentsTreeItem.contextValueConnected, { ...context, suppressCreatePick: true });
    }

    if (node.parent instanceof WebAppTreeItem) {
        await disconnectRepository(context, node.parent.client, node.parent.root);
    } else {
        throw Error(localize('actionNotSupported', 'Action not supported.'));
    }
}
