/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppContext } from '../../constants';
import { ITrialAppContext } from '../../explorer/trialApp/ITrialAppContext';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { addTrialAppTelemetry } from './addTrialAppTelemetry';

export async function removeTrialApp(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = ext.azureAccountTreeItem.trialAppNode;
    }

    const trialAppContext: ITrialAppContext | undefined = ext.context.globalState.get(TrialAppContext);
    if (!trialAppContext) {
        throw new Error(localize('noTrialContext', 'Cannot get trial app context.'));
    }

    const message: string = localize('removeTrialApp', 'Are you sure you want to remove trial app "{0}"?', trialAppContext.name);
    const remove: MessageItem = { title: 'Remove' };
    await ext.ui.showWarningMessage(message, { modal: true }, remove);

    if (node) {
        addTrialAppTelemetry(context, node);
    }
    ext.context.globalState.update(TrialAppContext, undefined);
    delete ext.azureAccountTreeItem.trialAppNode;
    await ext.tree.refresh();
}
