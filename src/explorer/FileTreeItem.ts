/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { IAzureTreeItem } from 'vscode-azureextensionui';
import { KuduClient } from '../KuduClient';


export class FileTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'File';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly childTypeLabel: string = 'File';
    public readonly commandId: string = 'appService.editFile';

    constructor(readonly site: Site, readonly label: string, readonly path: string, readonly kuduClient: KuduClient) {
    }

    public get id(): string {
        return `${this.site.id}/File`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: '',
            dark: ''
        };
    }

    public async showEditor() {
        console.log(this);
    }
}
