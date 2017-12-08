/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { FileTreeItem } from '../FileTreeItem';
import { BaseEditor } from './baseEditor';

export class FileEditor extends BaseEditor<IAzureNode<FileTreeItem>> {
    constructor() {
        super('azureStorage.blob.dontShow.SaveEqualsUpdateToAzure')
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

    async updateData(node: IAzureNode<FileTreeItem>, data: string): Promise<string> {
        var fileService = azureStorage.createFileService(node.storageAccount.name, node.key.value);

        await new Promise<string>((resolve, reject) => {
            fileService.createFileFromText(node.share.name, '', node.file.name, data, async (error: Error, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if (!!error) {
                    var errorAny = <any>error;
                    if (!!errorAny.code) {
                        var humanReadableMessage = `Unable to save '${node.file.name}' file service returned error code "${errorAny.code}"`;
                        switch (errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection."
                                break;
                        }
                        reject(humanReadableMessage);
                    } else {
                        reject(error);
                    }
                } else {
                    resolve();
                }
            });
        });

        return await this.getData(node);
    }
}
