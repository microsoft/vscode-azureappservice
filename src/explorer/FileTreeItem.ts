/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';

export class FileTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'file';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly commandId: string = 'appService.showFile';
    public etag: string | undefined; // cannot create etag on creation due to Kudu API calls

    constructor(parent: AzureParentTreeItem, readonly label: string, readonly path: string) {
        super(parent);
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('File_16x');
    }
}
