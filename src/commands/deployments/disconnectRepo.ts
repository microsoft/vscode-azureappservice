/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentsTreeItem, disconnectRepo as disconnectRepository } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { webAppFilter } from "../../constants";
import { OperationNotSupportedError } from '../../errors';
import { ext } from "../../extensionVariables";
import { isResolvedWebAppResource } from "../../tree/ResolvedWebAppResource";

export async function disconnectRepo(context: IActionContext, node?: DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<DeploymentsTreeItem>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(DeploymentsTreeItem.contextValueConnected)
        });
    }

    if (isResolvedWebAppResource(node.parent)) {
        await disconnectRepository(context, node.parent.site, node.subscription);
    } else {
        throw new OperationNotSupportedError(context);
    }
}
