/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureAccountTreeItemBase, GenericTreeItem, IActionContext, ISubscriptionContext } from 'vscode-azureextensionui';
import { TrialAppContext } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { getIconPath } from '../utils/pathUtils';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';
import { ExpiredTrialAppTreeItem } from './trialApp/ExpiredTrialAppTreeItem';
import { ITrialAppContext } from './trialApp/ITrialAppContext';
import { TrialAppTreeItem } from './trialApp/TrialAppTreeItem';

export class AzureAccountTreeItem extends AzureAccountTreeItemBase {

    public trialAppNode: TrialAppTreeItem | undefined;

    public constructor(testAccount?: {}) {
        super(undefined, testAccount);
    }

    public createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItem {
        return new SubscriptionTreeItem(this, root);
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const ti: AzExtTreeItem | undefined = this.trialAppNode ?? await this.loadTrialAppNode();
        const children: AzExtTreeItem[] = await super.loadMoreChildrenImpl(clearCache, context);

        if (ti) {
            children.push(ti);
        } else {
            if (!this.isLoggedIn) {
                children.push(new GenericTreeItem(this, { label: 'Create a Free Trial App...', contextValue: 'createTrialApp', commandId: `${ext.prefix}.CreateTrialApp`, iconPath: getIconPath('WebApp') }));
            }
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

    public async pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined> {
        const subscription: string = localize('subscription', 'subscription');
        const subscriptionOrTrialApp: string = localize('subscriptionOrTrialApp', 'subscription or trial app');
        const trialApp: string = localize('trialApp', 'trial app');

        if (expectedContextValues.includes(TrialAppTreeItem.contextValue) && this.trialAppNode) {
            this.childTypeLabel = this.isLoggedIn ? subscriptionOrTrialApp : trialApp;
        } else {
            this.childTypeLabel = subscription;
        }

        return super.pickTreeItemImpl(expectedContextValues);
    }

    public async refreshImpl(): Promise<void> {
        await this.loadTrialAppNode();
        await this.trialAppNode?.refresh();
    }

    private async loadTrialAppNode(): Promise<AzExtTreeItem | undefined> {
        const trialAppContext: ITrialAppContext | undefined = ext.context.globalState.get(TrialAppContext);
        if (!trialAppContext) {
            this.trialAppNode = undefined;
            return undefined;
        }

        if (trialAppContext.expirationDate < Date.now()) {
            this.trialAppNode = undefined;
            return new ExpiredTrialAppTreeItem(this, trialAppContext.name);
        }

        const ti: AzExtTreeItem[] = await this.createTreeItemsWithErrorHandling(
            [trialAppContext.loginSession],
            'trialAppInvalid',
            async (source: string): Promise<AzExtTreeItem> => {
                return await TrialAppTreeItem.createTrialAppTreeItem(this, source);
            },
            (_source: unknown): string => {
                return 'Trial App';
            });

        const treeItem: AzExtTreeItem | undefined = ti.pop();
        this.trialAppNode = treeItem instanceof TrialAppTreeItem ? treeItem : undefined;
        return treeItem;
    }
}
