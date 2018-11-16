/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { extname } from "path";
import { TextDocument, window, workspace } from "vscode";
import { getFile, IFileResult } from "vscode-azureappservice";
import { FileEditor } from "../explorer/editors/FileEditor";
import { FileTreeItem } from "../explorer/FileTreeItem";

export async function showFile(node: FileTreeItem, fileEditor: FileEditor): Promise<void> {
    // we don't want to let users save log files, so rather than using the FileEditor, just open an untitled document
    if (/^LogFiles(\/|\\)/i.test(node.path)) {
        const file: IFileResult = await getFile(node.root.client, node.path);
        const document: TextDocument = await workspace.openTextDocument({
            language: extname(node.path).substring(1), // remove the prepending dot of the ext
            content: file.data
        });
        await window.showTextDocument(document);
    } else {
        await fileEditor.showEditor(node);
    }

}
