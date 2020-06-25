/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { createWebApp } from '../createWebApp/createWebApp';
import { deploy } from '../deploy/deploy';

export async function transferToSubscription(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    if (!node) {
        node = ext.azureAccountTreeItem.trialAppNode;
    }

    if (node) {
        const newSite: WebAppTreeItem = await createWebApp(context, undefined, true);
        await deploy(context, newSite, undefined, true);
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
