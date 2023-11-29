/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type FileTreeItem } from "@microsoft/vscode-azext-azureappservice";
import { nonNullValue, type IActionContext } from "@microsoft/vscode-azext-utils";
import { type FileSystemItem } from "../AppServiceFileSystem";
import { ext } from "../extensionVariables";
import { localize } from "../localize";

export async function showFile(context: IActionContext, treeItem?: FileTreeItem): Promise<void> {
    const node = nonNullValue(treeItem);
    context.telemetry.eventVersion = 2;

    ext.fileSystem.appendLineToOutput(localize('opening', 'Opening "{0}"...', node.label), { resourceName: node.site.fullName });
    if (node.isReadOnly) {
        await node.openReadOnly(context);
    } else {
        // ensure node.id is defined
        node.id = node.fullId;
        await ext.fileSystem.showTextDocument(node as FileSystemItem);
    }
}
