/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import { getFile, IFileResult, putFile } from 'vscode-azureappservice';
import { BaseEditor } from 'vscode-azureextensionui';
import { nonNullProp } from '../../utils/nonNull';
import { FileTreeItem } from '../FileTreeItem';

export class FileEditor extends BaseEditor<FileTreeItem> {
    constructor() {
        super('appService.showSavePrompt');
    }

    public async getSaveConfirmationText(node: FileTreeItem): Promise<string> {
        return `Saving '${node.label}' will update the file "${node.label}" in "${node.root.client.fullName}".`;
    }

    public async getFilename(node: FileTreeItem): Promise<string> {
        return node.label;
    }

    public async getData(node: FileTreeItem): Promise<string> {
        const result: IFileResult = await getFile(node.root.client, node.path);
        node.etag = result.etag;
        return result.data;
    }

    public async getSize(_node: FileTreeItem): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;
    }

    public async updateData(node: FileTreeItem): Promise<string> {
        if (!vscode.window.activeTextEditor) {
            throw new Error('Cannot update file after it has been closed.');
        }
        const localFile: Readable = fs.createReadStream(vscode.window.activeTextEditor.document.uri.fsPath);
        node.etag = await putFile(node.root.client, localFile, node.path, nonNullProp(node, 'etag'));
        return await this.getData(node);
    }
}
