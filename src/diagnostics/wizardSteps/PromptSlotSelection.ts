import { Site } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { IAzureNode, IAzureParentNode, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { DeploymentSlotsTreeItem } from '../../explorer/DeploymentSlotsTreeItem';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import * as util from '../../util';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class PromptSlotSelection extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, readonly site: Site) {
        super(_wizard, 'Choose a deployment slot.');
    }

    public async prompt(): Promise<void> {
        let deploymentSlotsTreeItems: SiteTreeItem[];

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = 'Enumerating deployment slots for the App Service...';
            p.report({ message: message });
            this._wizard.writeline(message);
            deploymentSlotsTreeItems = await this.getDeploymentSlotsTreeItems();
        });

        this._wizard.writeline(`Got ${deploymentSlotsTreeItems.length} deployment slot(s)`);

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlotsTreeItems.length === 1) {
            this._wizard.selectedDeploymentSlotTreeItem = deploymentSlotsTreeItems[0];
            this._wizard.writeline(`Automatically selected deployment solt ${this._wizard.selectedDeploymentSlot.name}.`);
            return;
        }

        const deploymentQuickPickItems = deploymentSlotsTreeItems.map((deploymentSlotTreeItem: SiteTreeItem) => {
            const deploymentSlot = deploymentSlotTreeItem.site;
            return <util.IQuickPickItemWithData<SiteTreeItem>>{
                label: util.extractDeploymentSlotName(deploymentSlot) || deploymentSlot.name,
                description: '',
                data: deploymentSlotTreeItem
            };
        });

        const quickPickOption = { placeHolder: `Please select a deployment slot: (${this.stepProgressText})` };
        let pickedItem;
        try {
            pickedItem = await this.showQuickPick(deploymentQuickPickItems, quickPickOption);
        } catch (e) {
            if (e instanceof UserCancelledError) {
                vscode.window.showInformationMessage('Please select a deployment slot.');
            }
            throw e;
        }
        this._wizard.selectedDeploymentSlotTreeItem = pickedItem.data;
        this._wizard.writeline(`The deployment slot you selected is: ${this._wizard.selectedDeploymentSlot.name}`);
    }

    /**
     * Returns all the deployment slots and the production slot.
     */
    private async getDeploymentSlotsTreeItems(): Promise<SiteTreeItem[]> {
        const appServiceTreeItem = <IAzureParentNode<SiteTreeItem>>this._wizard.uiTreeItem;
        const result = await appServiceTreeItem.getCachedChildren();

        let deploymentSlotsCategoryNode: IAzureParentNode<IAzureTreeItem>;
        if (!result || result.length <= 0) {
            throw new Error('Cannot find any tree node under the App Service node.');
        }

        result.forEach((treeNode: IAzureNode<IAzureTreeItem>) => {
            if (treeNode.treeItem instanceof DeploymentSlotsTreeItem) {
                deploymentSlotsCategoryNode = <IAzureParentNode<IAzureTreeItem>>treeNode;
            }
        });

        if (!deploymentSlotsCategoryNode) {
            throw new Error('Cannot find the Deployment Slots tree node');
        }

        const deploymentSlotTreeNodes = await deploymentSlotsCategoryNode.getCachedChildren();
        const deploymentSlotTreeItems = deploymentSlotTreeNodes.map((node: IAzureNode<SiteTreeItem>) => {
            return node.treeItem;
        });

        return [this._wizard.uiTreeItem.treeItem].concat(deploymentSlotTreeItems);
    }
}
