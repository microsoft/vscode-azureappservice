/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AppSettingTreeItem } from "vscode-azureappservice";

export async function toggleValueVisability(node: AppSettingTreeItem): Promise<void> {
    node.toggleValueVisability();
    await node.refresh();
}
