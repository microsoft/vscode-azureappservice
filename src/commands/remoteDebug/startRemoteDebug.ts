/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as vscode from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { WebAppTreeItem } from '../../tree/WebAppTreeItem';
import { getRemoteDebugLanguage } from './getRemoteDebugLanguage';

export async function startRemoteDebug(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    }

    const client = await node.site.createClient(context);
    const siteConfig: WebSiteManagementModels.SiteConfigResource = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token) => {
        appservice.reportMessage(localize('fetchingConfig', 'Fetching site configuration...'), progress, token);
        return await client.getSiteConfig();
    });

    const language: appservice.RemoteDebugLanguage = getRemoteDebugLanguage(siteConfig, context);

    await appservice.startRemoteDebug(context, node.site, siteConfig, language);
}
