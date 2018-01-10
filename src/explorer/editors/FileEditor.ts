/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import { FileTreeItem } from '../FileTreeItem';
import { KuduClient } from '../../KuduClient';
import { getOutputChannel } from '../../util';
import { nodeUtils } from '../../utils/nodeUtils';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('appService.showSavePrompt', getOutputChannel())
    }

    async getSaveConfirmationText(node: IAzureNode<FileTreeItem>): Promise<string> {
        return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in "${node.treeItem.siteWrapper.name}".`;
    }

    async getFilename(node: IAzureNode<FileTreeItem>): Promise<string> {
        return node.treeItem.label;
    }

    async getData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const publishingCredential = await node.treeItem.siteWrapper.getWebAppPublishCredential(webAppClient);
        const kuduClient = new KuduClient(node.treeItem.siteWrapper.appName, publishingCredential.publishingUserName, publishingCredential.publishingPassword);

        return await kuduClient.getFile(node.treeItem.path);
    }

    async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;

    }

    async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const publishingCredential = await node.treeItem.siteWrapper.getWebAppPublishCredential(webAppClient);
        const kuduClient = new KuduClient(node.treeItem.siteWrapper.name, publishingCredential.publishingUserName, publishingCredential.publishingPassword);

        const localPath: string = vscode.window.activeTextEditor.document.fileName;
        const destPath: string = node.treeItem.path;

        await kuduClient.uploadFile(localPath, destPath);
        return await this.getData(node);
    }
}
