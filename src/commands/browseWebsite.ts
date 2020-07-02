/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { ISiteTreeItem } from '../explorer/ISiteTreeItem';
import { TrialAppTreeItem } from '../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../explorer/WebAppTreeItem';
import { ext } from '../extensionVariables';

export async function browseWebsite(context: IActionContext, node?: ISiteTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<WebAppTreeItem>(WebAppTreeItem.contextValue, context);
    }

    if (node instanceof TrialAppTreeItem) {
        context.telemetry.properties.trialApp = 'true';
        context.telemetry.properties.trialTimeRemaining = String(node.metadata.timeLeft);
    }

    await node.browse();
}
