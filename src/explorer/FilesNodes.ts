/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import { KuduClient, kuduFile } from '../KuduClient';
import * as util from '../util';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { NodeBase } from './NodeBase';

export class FilesNode extends NodeBase {
    private readonly site: WebSiteModels.Site;
    private readonly subscription: SubscriptionModels.Subscription;
    private readonly fsPath: string;
    constructor(
        label: string,
        fsPath: string,
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, treeDataProvider, parentNode);
        this.fsPath = fsPath;
        this.site = site;
        this.subscription = subscription;
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Folder_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Folder_16x_vscode.svg')
            }
        };
    }

    public async getChildren(): Promise<NodeBase[]> {
        const nodes: NodeBase[] = [];
        const webAppClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        const user = await util.getWebAppPublishCredential(webAppClient, this.site);
        const kuduClient = new KuduClient(this.site.name, user.publishingUserName, user.publishingPassword);

        const files: kuduFile[] = await kuduClient.listFiles(this.fsPath);

        for (const file of files) {
            let fsPath = file.path.substring('/home/'.length);
            if (file.path.includes('D:')) {
                // issue where Standard tier paths include D: and Basic does not
                fsPath = fsPath.substring('D:'.length);
            }
            // vfs.listFiles searches for a relative path file

            const treeDataProvider = this.getTreeDataProvider<AppServiceDataProvider>();
            const node = file.mime === 'inode/directory' ?
                new FilesNode(file.name, fsPath, this.site, this.subscription, treeDataProvider, this) :
                new NodeBase(file.name, treeDataProvider, this);
            nodes.push(node);
        }

        return nodes;
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }
}
