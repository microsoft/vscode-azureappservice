/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, Uri } from "vscode";
import { configurationSettings, none } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { SiteTreeItemBase } from '../../explorer/SiteTreeItemBase';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from '../../extensionVariables';
import { getWorkspaceSetting, updateWorkspaceSetting } from "../../vsCodeConfig/settings";
import { IDeployContext, WebAppSource } from "./IDeployContext";

export interface IDeployNode {
    node: SiteTreeItem | TrialAppTreeItem;
    isNewWebApp: boolean;
}

export async function getDeployNode(context: IDeployContext, target: Uri | string | SiteTreeItem | TrialAppTreeItem | undefined, isTargetNewWebApp: boolean): Promise<IDeployNode> {
    const defaultWebAppId: string | undefined = getWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, context.workspace.uri.fsPath);
    let node: SiteTreeItem | TrialAppTreeItem | undefined;

    // if the entry point for deploy was via "Deploy" after creating, it is also a new web app (so confirmDeployment would be false)
    let isNewWebApp: boolean = isTargetNewWebApp;
    if (target instanceof SiteTreeItemBase) {
        node = target;
    } else if (defaultWebAppId && defaultWebAppId !== none && !(ext.azureAccountTreeItem.trialAppNode && ext.azureAccountTreeItem.isLoggedIn)) {
        node = await ext.tree.findTreeItem(defaultWebAppId, context); // resolves to undefined if app can't be found
        if (node) {
            context.webAppSource = WebAppSource.setting;
        } else {
            // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
            await updateWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, undefined, context.workspace.uri.fsPath);
        }
    }

    if (!node) {
        context.webAppSource = WebAppSource.nodePicker;
        const newNodes: SiteTreeItem[] = [];
        const disposable: Disposable = ext.tree.onTreeItemCreate((newNode: SiteTreeItem) => { newNodes.push(newNode); });
        try {
            node = await ext.tree.showTreeItemPicker<SiteTreeItem>([WebAppTreeItem.contextValue, TrialAppTreeItem.contextValue], context);
        } finally {
            disposable.dispose();
        }

        isNewWebApp = newNodes.some((newNode: SiteTreeItem) => !!node && newNode.fullId === node.fullId);
    }

    return { node, isNewWebApp };
}
