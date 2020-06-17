/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileTreeItem } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";

export async function showFile(_context: IActionContext, node: FileTreeItem): Promise<void> {
    if (node.isReadOnly) {
        await node.openReadOnly();
    } else {
        await ext.fileSystem.showTextDocument(node);
    }
}
