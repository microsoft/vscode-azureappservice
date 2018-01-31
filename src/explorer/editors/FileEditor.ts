/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { getOutputChannel } from '../../util';
import { kuduIncomingMessage } from '../../KuduClient';
import { nodeUtils } from '../../utils/nodeUtils';
import { FileTreeItem } from '../FileTreeItem';
import { Readable } from 'stream';

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
        const httpResponse: kuduIncomingMessage = <kuduIncomingMessage>(await kuduClient.vfs.getItemWithHttpOperationResponse(node.treeItem.path)).response;
        node.treeItem.etag = <string>httpResponse.headers.etag; // this should not be a string[]
        return httpResponse.body;
    }

    public async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;

    }

    public async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const kuduClient: KuduClient = await node.treeItem.siteWrapper.getKuduClient(webAppClient);
        const localFile: Readable = fs.createReadStream(vscode.window.activeTextEditor.document.uri.fsPath);
        const destPath: string = node.treeItem.path;
        await kuduClient.vfs.putItem(localFile, destPath, { customHeaders: { ['If-Match']: node.treeItem.etag } });
        return await this.getData(node);
    }
}
