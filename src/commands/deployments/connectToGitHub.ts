/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { GenericTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import { ScmType } from "../../constants";
import { ext } from "../../extensionVariables";
import { ResolvedWebAppResource } from "../../tree/ResolvedWebAppResource";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { editScmType } from './editScmType';

export async function connectToGitHub(context: IActionContext, target?: GenericTreeItem): Promise<void> {
    let node: SiteTreeItem | DeploymentsTreeItem;

    if (!target) {
        node = <SiteTreeItem>await ext.rgApi.tree.showTreeItemPicker(new RegExp(ResolvedWebAppResource.webAppContextValue), context);
    } else {
        node = <DeploymentsTreeItem>target.parent;
    }

    await editScmType(context, node, ScmType.GitHub);
}
