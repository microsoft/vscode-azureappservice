import * as utils from 'util';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../explorer/WebAppTreeItem";
import { ext } from "../extensionVariables";

export async function configurePipeline(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    if (await isAzurePipelinesExtensionInstalled()) {
        if (!node) {
            node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue, context);
        }

        await executeAzurePipelineExtensionCommand(configurePipelineCommand, node);
    }
}

async function isAzurePipelinesExtensionInstalled(): Promise<boolean> {
    const pipelinesExtension = vscode.extensions.getExtension(azurePipelinesExtensionId);
    if (!pipelinesExtension) {
        try {
            await ext.ui.showWarningMessage('Please install/enable `Deploy to Azure` extension to continue.', { modal: true }, { title: 'Install' });
        } catch (err) {
            return false;
        }

        await vscode.commands.executeCommand('extension.open', azurePipelinesExtensionId);
        return false;
    }

    return true;
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
