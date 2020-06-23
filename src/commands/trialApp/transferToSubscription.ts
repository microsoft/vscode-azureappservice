/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { deploy } from '../deploy/deploy';

export async function transferToSubscription(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = ext.azureAccountTreeItem.trialAppNode;
    }

    if (node) {
        await deploy(context, undefined, undefined, true);
    } else {
        throw Error('Trial app not found');
    }
}
