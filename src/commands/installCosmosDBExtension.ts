/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from '../explorer/CosmosDBTreeItem';
import { installExtension } from '../utils/installExtension';

export async function installCosmosDBExtension(context: IActionContext, treeItem: AzureTreeItem): Promise<void> {
    const extensionId: string = 'ms-azuretools.vscode-cosmosdb';
    if (await installExtension(extensionId)) {
        if (treeItem.parent) {
            await treeItem.parent.refresh();
            if ((<CosmosDBTreeItem>treeItem.parent).cosmosDBExtension) {
                context.telemetry.properties.installedCosmos = 'true';
            }
        }
    }
}
