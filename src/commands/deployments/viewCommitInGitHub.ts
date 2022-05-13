/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { webAppFilter } from "../../constants";
import { ext } from "../../extensionVariables";

export async function viewCommitInGitHub(context: IActionContext, node?: DeploymentTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<DeploymentTreeItem>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: 'deployment/github'
        });
    }
    await node.viewCommitInGitHub(context);
}
