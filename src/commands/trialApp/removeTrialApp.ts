/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from 'vscode';
import { DialogResponses, IActionContext } from 'vscode-azureextensionui';
import { TrialAppLoginSession } from '../../constants';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';

export async function removeTrialApp(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<TrialAppTreeItem>(TrialAppTreeItem.contextValue, context);
    }

    const message: string = `Are you sure you want to remove Trial app "${node.client.fullName}"?`;
    const remove: MessageItem = { title: 'Remove' };
    window.showInformationMessage(message, { modal: true }, remove, DialogResponses.cancel).then(async (response: MessageItem): Promise<void> => {
        if (response === remove) {
            ext.context.globalState.update(TrialAppLoginSession, undefined);
            delete ext.azureAccountTreeItem.trialAppNode;
            await ext.tree.refresh();
        }
    });
}
