/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import { IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../constants";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { DeploymentSlotsTreeItem } from "../tree/DeploymentSlotsTreeItem";
import { DeploymentSlotTreeItem } from "../tree/DeploymentSlotTreeItem";
import { showCreatedWebAppMessage } from "./createWebApp/showCreatedWebAppMessage";
import { editScmType } from "./deployments/editScmType";

export async function createSlot(context: IActionContext, node?: DeploymentSlotsTreeItem | undefined): Promise<void> {
    if (!node) {
        const noItemFoundErrorMessage: string = localize('noWebAppForSlot', 'The selected web app does not support slots. View supported plans [here](https://aka.ms/AA7aoe4).');
        node = <DeploymentSlotsTreeItem>await ext.tree.showTreeItemPicker(DeploymentSlotsTreeItem.contextValue, { ...context, noItemFoundErrorMessage });
    }

    const createdSlot: DeploymentSlotTreeItem = <DeploymentSlotTreeItem>await node.createChild(context);
    showCreatedWebAppMessage(context, createdSlot);

    const client = await node.parent.site.createClient(context);
    // set the deploy source as the same as its production slot
    const siteConfig: WebSiteManagementModels.SiteConfigResource = await client.getSiteConfig();
    if (siteConfig.scmType !== ScmType.None) {
        switch (siteConfig.scmType) {
            case ScmType.LocalGit:
                await editScmType(context, createdSlot, ScmType.LocalGit, false);
                break;
            case ScmType.GitHub:
                await editScmType(context, createdSlot, ScmType.GitHub, false);
                break;
            default:
                break;
        }
    }
}
