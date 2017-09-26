/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import { NodeBase } from './nodeBase';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import * as path from 'path';
import { KuduClient, webJob } from '../kuduClient';
import * as util from '../util';

export class WebJobsNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, 
        readonly subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super('WebJobs', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: "webJobs",
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'AzureWebJobs_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'AzureWebJobs_16x_vscode.svg')
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        let nodes = [];
        let user = await util.getWebAppPublishCredential(this.azureAccount, this.subscription, this.site);
        let kuduClient = new KuduClient(this.site.name, user.publishingUserName, user.publishingPassword);
        
        let jobList: webJob[] = await kuduClient.listAllWebJobs() ;

        for (let job of jobList) {
            nodes.push(new NodeBase(job.name, this.getTreeDataProvider(), this));
        }
        return nodes;
    }

    openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}/webJobs`;
        opn(deepLink);
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }    
}