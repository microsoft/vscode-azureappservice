/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { NodeBase } from './nodeBase';
import { SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import * as path from 'path';
import { KuduClient, kuduFile } from '../kuduClient';
import * as util from '../util';


export class FilesNode extends NodeBase {
    constructor(readonly label: string, readonly path: string, readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription) {
        super(label);
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

    async getChildren(azureAccount: AzureAccountWrapper): Promise<NodeBase[]> {
        let nodes = [];
        let user = await util.getWebAppPublishCredential(azureAccount, this.subscription, this.site);
        let kuduClient = new KuduClient(this.site.name, user.publishingUserName, user.publishingPassword);
        
        let files : kuduFile[] = await kuduClient.listFiles(this.path);

        for (let file of files) {
            let path = file.path.substring('/home/'.length);
            if (file.path.includes('D:')) {
                // issue where Standard tier paths include D: and Basic does not
                path = path.substring('D:'.length);
            }
            // vfs.listFiles searches for a relative path file

            let node = file.mime === "inode/directory" ? new FilesNode(file.name, path, this.site, this.subscription) : new NodeBase(file.name);            
            nodes.push(node);
        }

        return nodes;
    }
}