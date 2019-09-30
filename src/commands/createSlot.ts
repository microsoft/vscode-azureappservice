import { SiteConfigResource } from "azure-arm-website/lib/models";
import { MessageItem, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { deploy } from '../commands/deploy/deploy';
import { AppServiceDialogResponses, ScmType } from "../constants";
import { DeploymentSlotsTreeItem } from "../explorer/DeploymentSlotsTreeItem";
import { DeploymentSlotTreeItem } from "../explorer/DeploymentSlotTreeItem";
import { ext } from "../extensionVariables";
import { editScmType } from "./deployments/editScmType";

export async function createSlot(context: IActionContext, node?: DeploymentSlotsTreeItem | undefined): Promise<void> {
    if (!node) {
        node = <DeploymentSlotsTreeItem>await ext.tree.showTreeItemPicker(DeploymentSlotsTreeItem.contextValue, context);
    }

    const createdSlot = <DeploymentSlotTreeItem>await node.createChild(context);
    // Note: intentionally not waiting for the result of this before returning
    const createdNewSlotMsg: string = `Created new slot "${createdSlot.root.client.fullName}": https://${createdSlot.root.client.defaultHostName}`;
    window.showInformationMessage(createdNewSlotMsg, AppServiceDialogResponses.deploy, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        if (result === AppServiceDialogResponses.viewOutput) {
            ext.outputChannel.show();
        } else if (result === AppServiceDialogResponses.deploy) {
            context.telemetry.properties.deploy = 'true';
            await deploy(context, false, createdSlot);
        }
    });

    // set the deploy source as the same as its production slot
    const siteConfig: SiteConfigResource = await node.root.client.getSiteConfig();
    if (siteConfig.scmType !== ScmType.None) {
        switch (siteConfig.scmType) {
            case ScmType.LocalGit:
                await editScmType(context, createdSlot, ScmType.LocalGit, false);
                break;
            case ScmType.GitHub:
                await editScmType(context, createdSlot, ScmType.GitHub, false);
                break;
            default:
                break;
        }
    }
}
