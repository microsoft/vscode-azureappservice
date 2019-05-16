/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem } from 'vscode-azureextensionui';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';

export class WebJobsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'webJobs';
    public readonly label: string = 'WebJobs';
    public readonly contextValue: string = WebJobsTreeItem.contextValue;
    public readonly childTypeLabel: string = 'Web Job';

    public get id(): string {
        return 'webJobs';
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath(this.root.client.isLinux ? 'WebJobs_grayscale' : 'WebJobs_color');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        let jobList: webJob[];
        try {
            jobList = <webJob[]>await this.root.client.listWebJobs();
        } catch (err) {
            if (this.root.client.isLinux) {
                // Can't find actual documentation on this, but the portal claims it and this feedback suggests it's not planned https://aka.ms/AA4q5gi
                return [new GenericTreeItem(this, { label: 'WebJobs are not available for Linux Apps.', contextValue: 'webJobNA' })];
            }

            throw err;
        }

        return jobList.map((job: webJob) => {
            return new GenericTreeItem(this, { id: job.name, label: job.name, contextValue: 'webJob' });
        });
    }
}

type webJob = { name: string, Message: string };
