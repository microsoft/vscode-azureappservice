/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem } from "@microsoft/vscode-azext-utils";

export abstract class NotAvailableTreeItem extends AzExtParentTreeItem {
    public constructor(parent: AzExtParentTreeItem) {
        super(parent);
    }
}
