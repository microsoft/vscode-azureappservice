/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppContext } from '../../constants';
import { ExpiredTrialAppTreeItem } from '../../explorer/trialApp/ExpiredTrialAppTreeItem';
import { ITrialAppContext } from '../../explorer/trialApp/ITrialAppContext';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { addTrialAppTelemetry } from './addTrialAppTelemetry';

export async function removeTrialApp(context: IActionContext, node?: TrialAppTreeItem | ExpiredTrialAppTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<TrialAppTreeItem>(TrialAppTreeItem.contextValue, context);
    }

    const trialAppContext: ITrialAppContext | undefined = ext.context.globalState.get(TrialAppContext);
    if (!trialAppContext) {
        return;
    }

    const message: string = localize('removeTrialApp', 'Are you sure you want to remove trial app "{0}"?', trialAppContext.name);
    const remove: MessageItem = { title: 'Remove' };
    await ext.ui.showWarningMessage(message, { modal: true }, remove);

    if (node instanceof TrialAppTreeItem) {
        addTrialAppTelemetry(context, node);
    } else {
        context.telemetry.properties.trialApp = 'true';
    }

    ext.context.globalState.update(TrialAppContext, undefined);
    delete ext.azureAccountTreeItem.trialAppNode;
    await ext.tree.refresh();
}
