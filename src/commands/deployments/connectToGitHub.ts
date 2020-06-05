/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "vscode-azureappservice";
import { GenericTreeItem, IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../../constants";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";
import { editScmType } from './editScmType';

export async function connectToGitHub(context: IActionContext, target?: GenericTreeItem): Promise<void> {
    let node: WebAppTreeItem | DeploymentsTreeItem;

    if (!target) {
        node = <WebAppTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    } else {
        node = <DeploymentsTreeItem>target.parent;
    }

    await editScmType(context, node, ScmType.GitHub);
}
