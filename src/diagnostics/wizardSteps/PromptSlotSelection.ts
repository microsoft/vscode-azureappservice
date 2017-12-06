import { Site } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../../util';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class PromptSlotSelection extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, readonly site: Site) {
        super(_wizard, 'Choose a deployment slot.');
    }

    public async prompt(): Promise<void> {
        let deploymentSlots: Site[];

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = 'Enumerating deployment slots for the App Service...';
            p.report({ message: message });
            this._wizard.writeline(message);
            deploymentSlots = await this.getDeploymentSlots();
        });

        this._wizard.writeline(`Got ${deploymentSlots.length} deployment slot(s)`);

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlots.length === 1) {
            this._wizard.selectedDeploymentSlot = deploymentSlots[0];
            this._wizard.writeline(`Automatically selected deployment solt ${this._wizard.selectedDeploymentSlot.name}.`);
            return;
        }

        const deploymentQuickPickItems = deploymentSlots.map((deploymentSlot: Site) => {
            return <util.IQuickPickItemWithData<Site>>{
                label: util.extractDeploymentSlotName(deploymentSlot) || deploymentSlot.name,
                description: '',
                data: deploymentSlot
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

        this._wizard.selectedDeploymentSlot = pickedItem.data;
        this._wizard.writeline(`The deployment slot you selected is: ${this._wizard.selectedDeploymentSlot.name}`);
    }
    /**
     * Returns all the deployment slots and the production slot.
     */
    private async getDeploymentSlots(): Promise<Site[]> {
        const client = this._wizard.websiteManagementClient;
        const allDeploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
        return allDeploymentSlots.filter((slot) => {
            return slot.repositorySiteName === this.site.name;
        });
    }
}
