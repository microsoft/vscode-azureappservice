/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath } from '../utils/pathUtils';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

const label: string = localize('webJobs', 'WebJobs');
export class WebJobsTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'webJobs';
    public readonly label: string = label;
    public readonly contextValue: string = WebJobsTreeItem.contextValue;
    public readonly childTypeLabel: string = localize('webJob', 'Web Job');
    public suppressMaskLabel = true;
    public parent!: SiteTreeItem;

    constructor(parent: SiteTreeItem) {
        super(parent);
    }

    public get id(): string {
        return 'webJobs';
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('WebJobs_color');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const client = await this.parent.site.createClient(context);
        return (await client.listWebJobs()).map(job => {
            return new GenericTreeItem(this, { id: job.name, label: nonNullProp(job, 'name'), contextValue: 'webJob' });
        });
    }
}

export class WebJobsNATreeItem extends NotAvailableTreeItem {
    public static contextValue: string = "webJobsNA";
    public readonly label: string = label;
    public readonly contextValue: string = WebJobsNATreeItem.contextValue;
    public suppressMaskLabel = true;

    public constructor(parent: AzExtParentTreeItem) {
        super(parent);
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('WebJobs_grayscale');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        return [new GenericTreeItem(this, { label: localize('webJobNA', 'WebJobs are not available for Linux Apps.'), contextValue: 'webJobNA' })];
    }
}
