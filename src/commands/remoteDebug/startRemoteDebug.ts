/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from '@azure/arm-appservice';
import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { webAppFilter } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { ResolvedWebAppResource } from '../../tree/ResolvedWebAppResource';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { getRemoteDebugLanguage } from './getRemoteDebugLanguage';

export async function startRemoteDebug(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<SiteTreeItem>(context, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(ResolvedWebAppResource.webAppContextValue)
        });
    }

    const client = await node.site.createClient(context);
    const siteConfig: SiteConfigResource = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, token) => {
        appservice.reportMessage(localize('fetchingConfig', 'Fetching site configuration...'), progress, token);
        return await client.getSiteConfig();
    });

    const language: appservice.RemoteDebugLanguage = getRemoteDebugLanguage(siteConfig, context);

    await appservice.startRemoteDebug(context, node.site, siteConfig, language);
}
