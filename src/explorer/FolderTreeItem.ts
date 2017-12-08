/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { FileTreeItem } from './FileTreeItem';
import { KuduClient, kuduFile } from '../KuduClient';
import * as util from '../util';
import { nodeUtils } from '../utils/nodeUtils';

export class FolderTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'Folder';
    public readonly contextValue: string = FolderTreeItem.contextValue;
    public readonly childTypeLabel: string = 'Files';
    constructor(readonly site: Site, readonly label: string, readonly path: string) {
    }

    public get id(): string {
        return `${this.site.id}/Folders`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Folder.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Folder.svg')
        };
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(node: IAzureNode<FolderTreeItem>): Promise<IAzureTreeItem[]> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const user = await util.getWebAppPublishCredential(webAppClient, node.treeItem.site);
        const kuduClient = new KuduClient(node.treeItem.site.name, user.publishingUserName, user.publishingPassword);

        const fileList: kuduFile[] = await kuduClient.listFiles(this.path);

        return fileList.map((file: kuduFile) => {
            return file.mime === 'inode/directory' ?
                // truncate the /home of the path
                new FolderTreeItem(this.site, file.name, file.path.substring(file.path.indexOf('site'))) :
                new FileTreeItem(this.site, file.name, file.path.substring(file.path.indexOf('site')), kuduClient);
        });
    }
}
