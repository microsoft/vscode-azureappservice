/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import { FileTreeItem } from '../FileTreeItem';
import { getOutputChannel } from '../../util';
import * as vscode from 'vscode';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('appService.showSavePrompt', getOutputChannel())
    }

    async getSaveConfirmationText(node: IAzureNode<FileTreeItem>): Promise<string> {
        return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in File Share "Azure blah blah"`;
    }

    async getFilename(node: IAzureNode<FileTreeItem>): Promise<string> {
        return node.treeItem.label;
    }

    async getData(node: IAzureNode<FileTreeItem>): Promise<string> {
        return await node.treeItem.kuduClient.getFile(node.treeItem.path);
    }

    async getSize(node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return node ? 0 : 0;

    }

    async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const localPath: string = vscode.window.activeTextEditor.document.fileName;
        const destPath: string = node.treeItem.path;
        await node.treeItem.kuduClient.uploadFile(localPath, destPath);
        return await this.getData(node);
    }
}
