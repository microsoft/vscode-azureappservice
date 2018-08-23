/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';

export class InvalidWebAppTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'invalidAppService';
    public readonly contextValue: string = InvalidWebAppTreeItem.contextValue;
    public readonly label: string;
    public readonly description: string = 'Invalid';

    // tslint:disable-next-line:no-any
    private _error: any;

    // tslint:disable-next-line:no-any
    constructor(label: string, error: any) {
        this.label = label;
        this._error = error;
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'WebApp_grayscale.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildren(_node: IAzureNode<IAzureTreeItem>, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        throw this._error;
    }

    public hasMoreChildren(): boolean {
        return false;
    }
}
