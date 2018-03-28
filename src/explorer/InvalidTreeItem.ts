/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';

export class InvalidTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = "invalidAppService";
    public readonly label: string = 'App Service is Invalid';
    public readonly contextValue: string = InvalidTreeItem.contextValue;
    public readonly id: string = InvalidTreeItem.contextValue;

    public get iconPath(): { light: string, dark: string } {
        return null;
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(_node: IAzureNode): Promise<IAzureTreeItem[]> {
        const id: string = 'InvalidAppServiceWarning';
        return [{ id: id, contextValue: id, label: "App Service configuration is invalid" }];
    }
}
