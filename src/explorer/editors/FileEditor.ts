/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import { IFileResult } from 'vscode-azureappservice';
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
        const result: IFileResult = await node.treeItem.siteWrapper.getFile(kuduClient, node.treeItem.path);
        node.treeItem.etag = result.etag;
        return result.data;
    }

    public async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;
    }

    public async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const webAppClient = nodeUtils.getWebSiteClient(node);
        const kuduClient: KuduClient = await node.treeItem.siteWrapper.getKuduClient(webAppClient);
        const localFile: Readable = fs.createReadStream(vscode.window.activeTextEditor.document.uri.fsPath);
        node.treeItem.etag = await node.treeItem.siteWrapper.putFile(kuduClient, localFile, node.treeItem.path, node.treeItem.etag);
        return await this.getData(node);
    }
}
