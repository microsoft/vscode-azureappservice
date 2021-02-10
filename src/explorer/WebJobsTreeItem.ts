/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';

const label: string = localize('webJobs', 'WebJobs');
export class WebJobsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'webJobs';
    public readonly label: string = label;
    public readonly contextValue: string = WebJobsTreeItem.contextValue;
    public readonly childTypeLabel: string = localize('webJob', 'Web Job');

    public get id(): string {
        return 'webJobs';
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('WebJobs_color');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        return (await this.root.client.listWebJobs()).map((job: webJob) => {
            return new GenericTreeItem(this, { id: job.name, label: job.name, contextValue: 'webJob' });
        });
    }
}

export class WebJobsNATreeItem extends NotAvailableTreeItem {
    public static contextValue: string = "webJobsNA";
    public readonly label: string = label;
    public readonly contextValue: string = WebJobsNATreeItem.contextValue;

    public constructor(parent: AzureParentTreeItem) {
        super(parent);
    }

    public get iconPath(): IThemedIconPath {
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

type webJob = { name: string, Message: string };
