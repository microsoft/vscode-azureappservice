/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureAccountTreeItemBase, GenericTreeItem, IActionContext, ISubscriptionContext } from 'vscode-azureextensionui';
import { TrialAppLoginSession } from '../constants';
import { ext } from '../extensionVariables';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';
import { TrialAppTreeItem } from './trialApp/TrialAppTreeItem';

export class AzureAccountTreeItem extends AzureAccountTreeItemBase {
    public constructor(testAccount?: {}) {
        super(undefined, testAccount);
    }

    public createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItem {
        return new SubscriptionTreeItem(this, root);
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const children: AzExtTreeItem[] = await super.loadMoreChildrenImpl(clearCache, context);

        const loginSession: string | undefined = ext.context.globalState.get(TrialAppLoginSession);

        if (loginSession) {
            children.push(await TrialAppTreeItem.createTrialAppTreeItem(this, loginSession));
        }

        return children;
    }

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        if (item2 instanceof GenericTreeItem) {
            return 1; // trial apps below sign in / create account items
        }
        if (!(item1 instanceof SubscriptionTreeItem) && item2 instanceof SubscriptionTreeItem) {
            return -1; // trial apps on top of subscription items
        }
        return super.compareChildrenImpl(item1, item2);
    }
}
