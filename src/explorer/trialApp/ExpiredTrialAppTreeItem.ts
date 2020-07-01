/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, IActionContext } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { getIconPath } from "../../utils/pathUtils";

export class ExpiredTrialAppTreeItem extends AzExtParentTreeItem {
    public label: string;
    public contextValue: string = 'trialAppExpired';

    public description: string = 'Expired';

    public isAncestorOfImpl(contextValue: string | RegExp): boolean {
        return contextValue === this.contextValue;
    }

    public constructor(parent: AzExtParentTreeItem, name: string) {
        super(parent);
        this.label = name;
        this.iconPath = getIconPath('WebApp');
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return [new GenericTreeItem(this, { label: localize('transferToSubscription', 'Transfer to Subscription...'), commandId: `${ext.prefix}.TransferToSubscription`, contextValue: 'transferToSubscription', includeInTreeItemPicker: false })];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
