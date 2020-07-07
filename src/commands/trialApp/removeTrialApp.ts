/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, MessageItem } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppContext } from '../../constants';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { addTrialAppTelemetry } from './addTrialAppTelemetry';

export async function removeTrialApp(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = ext.azureAccountTreeItem.trialAppNode;
    }

    if (node) {
        const message: string = localize('removeTrialApp', 'Are you sure you want to remove trial app "{0}"?', node.client.fullName);
        const remove: MessageItem = { title: 'Remove' };
        await ext.ui.showWarningMessage(message, { modal: true }, remove);

        addTrialAppTelemetry(context, node);

        ext.context.globalState.update(TrialAppContext, undefined);
        await commands.executeCommand('setContext', 'hasTrialApp', false);
        delete ext.azureAccountTreeItem.trialAppNode;
        await ext.tree.refresh();
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
