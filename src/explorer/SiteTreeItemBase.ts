/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem } from 'vscode-azureextensionui';

export abstract class SiteTreeItemBase extends AzExtParentTreeItem {
    public readonly abstract contextValue: string;
    public readonly abstract label: string;

    constructor(parent: AzExtParentTreeItem) {
        super(parent);
    }
}
