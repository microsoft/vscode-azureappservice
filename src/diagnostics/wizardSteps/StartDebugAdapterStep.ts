import * as vscode from 'vscode';
import * as util from '../../util';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class StartDebugAdapterStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Start debug adapater.');
    }

    public async execute(): Promise<void> {
        const site = this._wizard.selectedDeploymentSlot;
        const siteName = util.extractSiteName(site) + (util.isSiteDeploymentSlot(site) ? `-${util.extractDeploymentSlotName(site)}` : '');
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(site);

        // Assume the next started debug sessionw is the one we will launch next.
        const startEventHandler = vscode.debug.onDidStartDebugSession(() => {
            startEventHandler.dispose();

            vscode.commands.executeCommand('workbench.view.debug');
        });
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
            type: "jsLogpoints",
            name: "Azure App Service LogPoints",
            request: "attach",
            trace: true,
            siteName: siteName,
            publishCredentialUsername: publishCredential.publishingUserName,
            publishCredentialPassword: publishCredential.publishingPassword,
            instanceId: this._wizard.selectedInstance.name,
            sessionId: this._wizard.sessionId,
            debugId: this._wizard.debuggerId
        });

        this._wizard.writeline("Debug session started.");
    }
}
