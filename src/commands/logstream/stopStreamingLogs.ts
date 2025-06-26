/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as appservice from '@microsoft/vscode-azext-azureappservice';
import { type IActionContext } from '@microsoft/vscode-azext-utils';
import { type SiteTreeItem } from '../../tree/SiteTreeItem';
import { pickWebApp } from '../../utils/pickWebApp';

export async function stopStreamingLogs(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = await pickWebApp({ ...context, suppressCreatePick: true });
    }

    await node.initSite(context);
    await appservice.stopStreamingLogs(node.site);
}
