/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import { getFile, IFileResult, putFile } from 'vscode-azureappservice';
import { BaseEditor, IAzureNode } from 'vscode-azureextensionui';
import { getOutputChannel } from '../../util';
import { FileTreeItem } from '../FileTreeItem';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('appService.showSavePrompt', getOutputChannel());
    }

    public async getSaveConfirmationText(node: IAzureNode<FileTreeItem>): Promise<string> {
        return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in "${node.treeItem.client.fullName}".`;
    }

    public async getFilename(node: IAzureNode<FileTreeItem>): Promise<string> {
        return node.treeItem.label;
    }

    public async getData(node: IAzureNode<FileTreeItem>): Promise<string> {
        const result: IFileResult = await getFile(node.treeItem.client, node.treeItem.path);
        node.treeItem.etag = result.etag;
        return result.data;
    }

    public async getSize(_node: IAzureNode<FileTreeItem>): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;
    }

    public async updateData(node: IAzureNode<FileTreeItem>): Promise<string> {
        if (!vscode.window.activeTextEditor) {
            throw new Error('Cannot update file after it has been closed.');
        }
        const localFile: Readable = fs.createReadStream(vscode.window.activeTextEditor.document.uri.fsPath);
        // tslint:disable-next-line:no-non-null-assertion
        node.treeItem.etag = await putFile(node.treeItem.client, localFile, node.treeItem.path, node.treeItem.etag!);
        return await this.getData(node);
    }
}
