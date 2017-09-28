/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { NodeBase } from './nodeBase';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import * as path from 'path';
import { KuduClient, kuduFile } from '../kuduClient';
import * as util from '../util';
import WebSiteManagementClient = require('azure-arm-website');

export class FilesNode extends NodeBase {
    constructor(readonly label: string,
        readonly path: string,
        readonly site: WebSiteModels.Site,
        readonly subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Folder_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Folder_16x_vscode.svg')
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        const nodes = [];
        const webAppClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        const user = await util.getWebAppPublishCredential(webAppClient, this.site);
        const kuduClient = new KuduClient(this.site.name, user.publishingUserName, user.publishingPassword);

        const files: kuduFile[] = await kuduClient.listFiles(this.path);

        for (let file of files) {
            let path = file.path.substring('/home/'.length);
            if (file.path.includes('D:')) {
                // issue where Standard tier paths include D: and Basic does not
                path = path.substring('D:'.length);
            }
            // vfs.listFiles searches for a relative path file

            const treeDataProvider = this.getTreeDataProvider<AppServiceDataProvider>();
            let node = file.mime === "inode/directory" ?
                new FilesNode(file.name, path, this.site, this.subscription, treeDataProvider, this) :
                new NodeBase(file.name, treeDataProvider, this);
            nodes.push(node);
        }

        return nodes;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }
}