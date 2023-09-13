/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from "@microsoft/vscode-azext-azureappservice";
import { DeploymentsTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ScmType } from "../../constants";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { pickWebApp } from "../../utils/pickWebApp";

export async function editScmType(context: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem, _nodes?: (SiteTreeItem | DeploymentsTreeItem)[], newScmType?: ScmType | unknown, showToast?: boolean | unknown): Promise<void> {
    if (!node) {
        node = await pickWebApp(context);
    } else if (node instanceof DeploymentsTreeItem) {
        node = <SiteTreeItem>node.parent;
    }

    if (node.deploymentsNode === undefined) {
        await node.refresh(context);
    }
    const _newScmType = newScmType as ScmType;
    const _showToast = showToast as boolean;

    await appservice.editScmType(context, node.site, node.subscription, _newScmType, _showToast);
    await node.deploymentsNode?.refresh(context);
}
