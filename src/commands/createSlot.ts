/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from "@azure/arm-appservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ScmType, webAppFilter } from "../constants";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { DeploymentSlotsTreeItem } from "../tree/DeploymentSlotsTreeItem";
import { SiteTreeItem } from "../tree/SiteTreeItem";
import { showCreatedWebAppMessage } from "./createWebApp/showCreatedWebAppMessage";
import { editScmType } from "./deployments/editScmType";

export async function createSlot(context: IActionContext, node?: DeploymentSlotsTreeItem | undefined): Promise<void> {
    if (!node) {
        const noItemFoundErrorMessage: string = localize('noWebAppForSlot', 'The selected web app does not support slots. View supported plans [here](https://aka.ms/AA7aoe4).');
        node = await ext.rgApi.pickAppResource<DeploymentSlotsTreeItem>({ ...context, noItemFoundErrorMessage }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(DeploymentSlotsTreeItem.contextValue)
        });
    }

    const createdSlot: SiteTreeItem = <SiteTreeItem>await node.createChild(context);
    showCreatedWebAppMessage(context, createdSlot);

    const client = await node.parent.site.createClient(context);
    // set the deploy source as the same as its production slot
    const siteConfig: SiteConfigResource = await client.getSiteConfig();
    if (siteConfig.scmType !== ScmType.None) {
        switch (siteConfig.scmType) {
            case ScmType.LocalGit:
                await editScmType(context, createdSlot, undefined, ScmType.LocalGit, false);
                break;
            case ScmType.GitHub:
                await editScmType(context, createdSlot, undefined, ScmType.GitHub, false);
                break;
            default:
                break;
        }
    }
}
