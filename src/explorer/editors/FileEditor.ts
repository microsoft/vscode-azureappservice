/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import { KuduClient } from '../../KuduClient';
import * as util from '../../util';
import { getOutputChannel } from '../../util';
import { nodeUtils } from '../../utils/nodeUtils';
import { FileTreeItem } from '../FileTreeItem';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('appService.showSavePrompt', getOutputChannel());
    }

    public async getSaveConfirmationText(node: IAzureNode<FileTreeItem>): Promise<string> {
        return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in "${node.treeItem.site.name}".`;
    }

    public async getFilename(node: IAzureNode<FileTreeItem>): Promise<string> {
        return node.treeItem.label;
    }

    public async getData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const user = await util.getWebAppPublishCredential(webAppClient, node.treeItem.site);
        const kuduClient = new KuduClient(node.treeItem.site.name, user.publishingUserName, user.publishingPassword);
        return await kuduClient.getFile(node.treeItem.path);
    }

    public async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;

    }

    public async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const user = await util.getWebAppPublishCredential(webAppClient, node.treeItem.site);
        const kuduClient = new KuduClient(node.treeItem.site.name, user.publishingUserName, user.publishingPassword);

        const localPath: string = vscode.window.activeTextEditor.document.fileName;
        const destPath: string = node.treeItem.path;

        await kuduClient.uploadFile(localPath, destPath);
        return await this.getData(node);
    }
}
