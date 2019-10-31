/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileTreeItem, getFile, IFileResult, putFile } from 'vscode-azureappservice';
import { BaseEditor } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';

export class FileEditor extends BaseEditor<FileTreeItem> {

    constructor() {
        super(`${ext.prefix}showSavePrompt`);
    }

    public async getSaveConfirmationText(node: FileTreeItem): Promise<string> {
        return `Saving '${node.label}' will update the file "${node.label}" in "${node.root.client.fullName}".`;
    }

    public async getFilename(node: FileTreeItem): Promise<string> {
        return node.label;
    }

    public async getData(node: FileTreeItem): Promise<string> {
        const result: IFileResult = await getFile(node.root.client, node.path);
        return result.data;
    }

    public async getSize(_node: FileTreeItem): Promise<number> {
        // this is not implemented for Azure App Services
        return 0;
    }

    public async updateData(node: FileTreeItem, data: string): Promise<string> {
        // because the etag can become stale, get the latest before updating
        const etag: string = (await getFile(node.root.client, node.path)).etag;
        await putFile(node.root.client, data, node.path, etag);
        return await this.getData(node);
    }
}
