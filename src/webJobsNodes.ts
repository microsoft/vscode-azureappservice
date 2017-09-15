/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { NodeBase } from './nodeBase';
import { SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import * as path from 'path';
import { KuduClient, webJob } from './kuduClient';
import * as util from './util';

export class WebJobsNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription) {
        super('WebJobs');
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'AzureWebJobs_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'AzureWebJobs_16x_vscode.svg')
            }
        }
    }

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        let nodes = [];
        let user = await util.getWebAppPublishCredential(azureAccount, this.subscription, this.site);
        let kuduClient = new KuduClient(this.site.name, user.publishingUserName, user.publishingPassword);
        
        let jobList: webJob[] = await kuduClient.listAllWebJobs() ;

        for (let job of jobList) {
            nodes.push(new NodeBase(job.name));
        }
        return nodes;
    }
}