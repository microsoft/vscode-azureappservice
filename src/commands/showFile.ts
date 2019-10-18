/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileTreeItem } from "vscode-azureappservice";
import { FileEditor } from "../explorer/editors/FileEditor";

export async function showFile(node: FileTreeItem, fileEditor: FileEditor): Promise<void> {
    if (node.isReadOnly) {
        await node.openReadOnly();
    } else {
        await fileEditor.showEditor(node);
    }
}
