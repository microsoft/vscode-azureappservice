/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem } from '@microsoft/vscode-azext-utils';

export namespace treeUtils {
    // replace with azext-utils when it's released
    export function isAzExtTreeItem(ti: unknown): ti is AzExtTreeItem {
        return !!ti && (ti as AzExtTreeItem).fullId !== undefined && (ti as AzExtTreeItem).fullId !== null;
    }
}
