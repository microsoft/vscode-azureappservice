/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class FileTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'file';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly commandId: string = 'appService.showFile';

    constructor(readonly site: Site, readonly label: string, readonly path: string) {
    }

    public get id(): string {
        return `${this.site.id}/File`;
    }
}
