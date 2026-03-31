/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, disconnectRepo as disconnectRepository } from "@microsoft/vscode-azext-azureappservice";
import { UserCancelledError, type IActionContext } from "@microsoft/vscode-azext-utils";
import { window } from "vscode";
import { ScmType, webAppFilter } from "../../constants";
import { OperationNotSupportedError } from '../../errors';
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { isResolvedWebAppResource } from "../../tree/ResolvedWebAppResource";
import { SiteTreeItem } from "../../tree/SiteTreeItem";

export async function disconnectRepo(context: IActionContext, node?: DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<DeploymentsTreeItem>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(DeploymentsTreeItem.contextValueConnected)
        });
    }

    if (isResolvedWebAppResource(node.parent) || node.parent instanceof SiteTreeItem) {
        const client = await node.parent.site.createClient(context);
        const siteConfig = await client.getSiteConfig();

        if (siteConfig.scmType === ScmType.None) {
            void window.showWarningMessage(localize('notConnectedToRepo', 'This app is not connected to any repository.'));
            throw new UserCancelledError('notConnectedToRepo');
        }

        await disconnectRepository(context, node.parent.site, node.parent instanceof SiteTreeItem ? node.parent.subscription : node.subscription);

        if (isResolvedWebAppResource(node.parent)) {
            await ext.rgApi.appResourceTree.refresh(context, node.parent);
        } else {
            await node.parent.refresh(context);
        }
    } else {
        throw new OperationNotSupportedError(context);
    }
}
