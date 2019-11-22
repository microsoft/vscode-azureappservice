/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands } from 'vscode';
import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from '../explorer/CosmosDBTreeItem';
import { delay } from '../utils/delay';

export async function installCosmosDBExtension(context: IActionContext, treeItem: AzureTreeItem): Promise<void> {
    const commandToRun: string = 'extension.open';
    commands.executeCommand(commandToRun, 'ms-azuretools.vscode-cosmosdb');

    // poll to see if the extension was installed for a minute
    const timeoutInSeconds: number = 60;
    const maxTime: number = Date.now() + timeoutInSeconds * 1000;

    while (Date.now() < maxTime) {
        if (treeItem.parent) {
            await treeItem.parent.refresh();
            if ((<CosmosDBTreeItem>treeItem.parent).cosmosDBExtension) {
                context.telemetry.properties.installedCosmos = 'true';
                break;
            }
        }

        await delay(5000);
    }
}
