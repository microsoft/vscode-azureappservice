/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { SiteClient } from 'vscode-azureappservice';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class CosmosDBTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'Connection';
    public readonly contextValue: string = CosmosDBTreeItem.contextValue;
    public readonly label: string = 'Connection';

    constructor(readonly client: SiteClient) {
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'CosmosDBAccount.svg';
        return {
            light: join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }
}
