/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { getOutputChannel } from '../../util';
import { nodeUtils } from '../../utils/nodeUtils';
import { FileTreeItem } from '../FileTreeItem';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('appService.showSavePrompt', getOutputChannel());
    }

    public async getSaveConfirmationText(node: IAzureNode<FileTreeItem>): Promise<string> {
        return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in "${node.treeItem.siteWrapper.appName}".`;
    }

    public async getFilename(node: IAzureNode<FileTreeItem>): Promise<string> {
        return node.treeItem.label;
    }

    public async getData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const kuduClient: KuduClient = await node.treeItem.siteWrapper.getKuduClient(webAppClient);
        // Kudu response is structured as a response.body
        return (await kuduClient.vfs.getItemWithHttpOperationResponse(node.treeItem.path)).response.body;


    }

    public async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;

    }

    public async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const kuduClient: KuduClient = await node.treeItem.siteWrapper.getKuduClient(webAppClient);

        const localPath: vscode.TextDocument = vscode.window.activeTextEditor.document.uri.fsPath;
        const destPath: string = node.treeItem.path;

        await kuduClient.vfs.putItem(localPath, destPath);
        return await this.getData(node);
    }
}
