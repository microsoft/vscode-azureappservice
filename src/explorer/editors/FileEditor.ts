/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import { FileTreeItem, getFile, IFileResult, putFile } from 'vscode-azureappservice';
import { BaseEditor } from 'vscode-azureextensionui';
import { nonNullValue } from '../../utils/nonNull';

export class FileEditor extends BaseEditor<FileTreeItem> {
    private _etags: Map<string, string> = new Map<string, string>();

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
        this._etags.set(node.fullId, result.etag);
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
        let etag: string = nonNullValue(this._etags.get(node.fullId), 'etag');
        etag = await putFile(node.root.client, localFile, node.path, etag);
        this._etags.set(node.fullId, etag);
        return await this.getData(node);
    }
}
