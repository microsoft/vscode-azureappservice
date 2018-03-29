/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class InvalidWebAppTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'invalidAppService';
    public readonly contextValue: string = InvalidWebAppTreeItem.contextValue;

    constructor(readonly label: string, readonly description: string) {
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'WebApp_grayscale.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }
}
