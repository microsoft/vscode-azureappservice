/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppLoginSession } from '../../constants';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';

export async function removeTrialApp(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<TrialAppTreeItem>(TrialAppTreeItem.contextValue, context);
    }

    const message: string = localize('removeTrialApp', 'Are you sure you want to remove trial app "{0}"?', node.client.fullName);
    const remove: MessageItem = { title: 'Remove' };
    const response: MessageItem | undefined = await ext.ui.showWarningMessage(message, { modal: true }, remove);

    if (response === remove) {
        ext.context.globalState.update(TrialAppLoginSession, undefined);
        delete ext.azureAccountTreeItem.trialAppNode;
        await ext.tree.refresh();
    }
}
