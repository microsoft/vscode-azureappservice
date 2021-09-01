/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileTreeItem } from "vscode-azureappservice";
import { IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { localize } from "../localize";

export async function showFile(context: IActionContext, node: FileTreeItem): Promise<void> {
    context.telemetry.eventVersion = 2;

    ext.fileSystem.appendLineToOutput(localize('opening', 'Opening "{0}"...', node.label), { resourceName: node.site.fullName });
    if (node.isReadOnly) {
        await node.openReadOnly(context);
    } else {
        await ext.fileSystem.showTextDocument(node);
    }
}
