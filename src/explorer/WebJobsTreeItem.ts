/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { getKuduClient, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, GenericTreeItem } from 'vscode-azureextensionui';

export class WebJobsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'webJobs';
    public readonly label: string = 'WebJobs';
    public readonly contextValue: string = WebJobsTreeItem.contextValue;
    public readonly childTypeLabel: string = 'Web Job';

    public get id(): string {
        return 'webJobs';
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'WebJobs_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'WebJobs_color.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const kuduClient = await getKuduClient(this.root.client);

        const jobList: webJob[] = <webJob[]>await kuduClient.jobs.listAllJobs();

        return jobList.map((job: webJob) => {
            return new GenericTreeItem<ISiteTreeRoot>(this, { id: job.name, label: job.name, contextValue: 'webJob' });
        });
    }
}

type webJob = { name: string, Message: string };
