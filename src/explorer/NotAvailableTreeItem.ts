/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from "vscode-azureappservice";
import { AzureParentTreeItem } from "vscode-azureextensionui";

export abstract class NotAvailableTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public constructor(parent: AzureParentTreeItem) {
        super(parent);
    }
}
