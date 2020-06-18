/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, SubscriptionTreeItem } from '../../extension.bundle';

// tslint:disable-next-line:export-name
export function findSubscriptionTreeItem(node: AzExtTreeItem): SubscriptionTreeItem {
    let root: AzExtTreeItem = node;
    while (!(root instanceof SubscriptionTreeItem) && root.parent !== undefined) {
        root = root.parent;
    }

    if (root instanceof SubscriptionTreeItem) {
        return root;
    } else {
        throw Error('Root is not instanceof SubscriptionTreeItem');
    }
}
