import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";
import { openUrl } from '../../utils/openUrl';

export async function configure(context: IActionContext, node: SiteTreeItem): Promise<void> {
    if (await IsAzurePipelinesExtensionInstalled()) {
        node = await getWebAppNode(context, node);
        executeAzurePipelineExtensionCommand(configurePipelineCommand, node);
    }
}

export async function browse(context: IActionContext, node: SiteTreeItem): Promise<void> {
    if (await IsAzurePipelinesExtensionInstalled()) {
        node = await getWebAppNode(context, node);
        executeAzurePipelineExtensionCommand(browsePipelineCommand, node);
    }
}

async function IsAzurePipelinesExtensionInstalled(): Promise<boolean> {
    let pipelinesExtension = vscode.extensions.getExtension(azurePipelinesExtensionId);
    if (!pipelinesExtension) {
        vscode.window.showInformationMessage('Please install `Azure Pipelines` extension to continue.');
        const commandToRun = 'extension.open';
        const listOfCommands = await vscode.commands.getCommands();
        if (listOfCommands.find((x: string) => x === commandToRun)) {
            vscode.commands.executeCommand(commandToRun, azurePipelinesExtensionId);
        } else {
            await openUrl('https://marketplace.visualstudio.com/items?itemName=ms-azure-devops.azure-pipelines');
        }

        return false;
    }

    return true;
}

async function getWebAppNode(context: IActionContext, node: SiteTreeItem): Promise<SiteTreeItem> {
    if (!node) {
        return await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    }

    return node;
}

async function executeAzurePipelineExtensionCommand(commandToRun: string, node: SiteTreeItem): Promise<any> {
    const listOfCommands = await vscode.commands.getCommands();
    if (listOfCommands.find((commmand) => commmand == commandToRun)) {
        return vscode.commands.executeCommand(commandToRun, node);
    }
}

const azurePipelinesExtensionId = 'ms-azure-devops.azure-pipelines';
const configurePipelineCommand = 'configure-pipeline';
const browsePipelineCommand = 'browse-pipeline';
