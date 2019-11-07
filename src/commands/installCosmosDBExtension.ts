import { commands } from 'vscode';
import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { CosmosDBTreeItem } from '../explorer/CosmosDBTreeItem';
import { delay } from '../utils/delay';
import { openUrl } from "../utils/openUrl";

export async function installCosmosDBExtension(context: IActionContext, treeItem: AzureTreeItem): Promise<void> {
    const commandToRun = 'extension.open';
    const listOfCommands = await commands.getCommands();
    if (listOfCommands.find((x: string) => x === commandToRun)) {
        commands.executeCommand(commandToRun, 'ms-azuretools.vscode-cosmosdb');
        context.telemetry.properties.viaVsCode = 'true';
    } else {
        // leads to https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb
        await openUrl('https://aka.ms/AA6irqo');
        context.telemetry.properties.viaVsCode = 'false';
    }

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
