/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, disconnectRepo as disconnectRepository } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { OperationNotSupportedError } from '../../errors';
import { ext } from "../../extensionVariables";
import { SiteTreeItem } from '../../tree/SiteTreeItem';

export async function disconnectRepo(context: IActionContext, node?: DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<DeploymentsTreeItem>(DeploymentsTreeItem.contextValueConnected, { ...context, suppressCreatePick: true });
    }

    if (node.parent instanceof SiteTreeItem) {
        await disconnectRepository(context, node.parent.site, node.subscription);
    } else {
        throw new OperationNotSupportedError(context);
    }
}
