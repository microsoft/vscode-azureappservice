/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import { webAppFilter } from '../../constants';
import { ext } from '../../extensionVariables';
import { ResolvedWebAppResource } from '../../tree/ResolvedWebAppResource';
import { SiteTreeItem } from '../../tree/SiteTreeItem';
import { enableFileLogging } from './enableFileLogging';

export async function startStreamingLogs(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<SiteTreeItem>({ ...context, suppressCreatePick: true }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(ResolvedWebAppResource.webAppContextValue)
        });
    }

    const verifyLoggingEnabled: () => Promise<void> = async (): Promise<void> => {
        await enableFileLogging({ ...context, suppressAlreadyEnabledMessage: true }, node);
    };

    await appservice.startStreamingLogs(context, node.site, verifyLoggingEnabled, node.logStreamLabel);
}
