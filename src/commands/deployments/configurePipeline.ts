import * as utils from 'util';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";
import { openUrl } from '../../utils/openUrl';

export async function configurePipeline(context: IActionContext, node: SiteTreeItem): Promise<void> {
    if (await isAzurePipelinesExtensionInstalled()) {
        node = await getWebAppNode(context, node);
        await executeAzurePipelineExtensionCommand(configurePipelineCommand, node);
    }
}

async function isAzurePipelinesExtensionInstalled(): Promise<boolean> {
    const pipelinesExtension = vscode.extensions.getExtension(azurePipelinesExtensionId);
    if (!pipelinesExtension) {
        vscode.window.showInformationMessage('Please install/enable `Deploy to Azure` extension to continue.');
        const commandToRun = 'extension.open';
        const listOfCommands = await vscode.commands.getCommands();
        if (listOfCommands.find((x: string) => x === commandToRun)) {
            await vscode.commands.executeCommand(commandToRun, azurePipelinesExtensionId);
        } else {
            await openUrl('https://marketplace.visualstudio.com/items?itemName=ms-vscode-deploy-azure.azure-deploy');
        }

        return false;
    }

    return true;
}

async function getWebAppNode(context: IActionContext, node: SiteTreeItem): Promise<SiteTreeItem> {
    if (node === null || node === undefined) {
        return await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
    }

    return node;
}

async function executeAzurePipelineExtensionCommand(commandToRun: string, node: SiteTreeItem): Promise<unknown> {
    const listOfCommands = await vscode.commands.getCommands();
    if (listOfCommands.find((commmand) => commmand === commandToRun)) {
        return vscode.commands.executeCommand(commandToRun, node);
    }

    throw new Error(utils.format('Unable to find command %s. Make sure `Deploy to Azure` extension is installed and enabled.', commandToRun));
}

const azurePipelinesExtensionId = 'ms-vscode-deploy-azure.azure-deploy';
const configurePipelineCommand = 'configure-cicd-pipeline';
