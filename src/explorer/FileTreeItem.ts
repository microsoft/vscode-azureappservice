/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class FileTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'file';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly commandId: string = 'appService.showFile';
    public etag: string | undefined; // cannot create etag on creation due to Kudu API calls

    constructor(readonly client: SiteClient, readonly label: string, readonly path: string) {
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: join(__filename, '..', '..', '..', '..', 'resources', 'light', 'File_16x.svg'),
            dark: join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'File_16x.svg')
        };
    }
}
