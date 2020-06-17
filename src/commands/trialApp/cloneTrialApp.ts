/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';

export async function cloneTrialApp(_context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = ext.azureAccountTreeItem.trialAppNode;
    }

    if (node) {
        await commands.executeCommand('git.clone', node.metadata.gitUrl);
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
