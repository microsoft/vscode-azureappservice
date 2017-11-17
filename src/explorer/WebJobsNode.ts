/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { KuduClient, webJob } from '../KuduClient';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';

export class WebJobsTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'webJobs';
    public readonly label: string = 'WebJobs';
    public readonly contextValue: string = WebJobsTreeItem.contextValue;
    public readonly childTypeLabel: string = 'Web Job';
    constructor(readonly site: Site) {
    }

    public get id(): string {
        return `${this.site.id}/webJobs`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'WebJobs_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'WebJobs_color.svg')
        };
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(node: IAzureNode<WebJobsTreeItem>): Promise<IAzureTreeItem[]> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const user = await util.getWebAppPublishCredential(webAppClient, node.treeItem.site);
        const kuduClient = new KuduClient(node.treeItem.site.name, user.publishingUserName, user.publishingPassword);

        const jobList: webJob[] = await kuduClient.listAllWebJobs();

        return jobList.map((job: webJob) => {
            return { id: job.name, label: job.name, contextValue: 'webJob' };
        });
    }
}
