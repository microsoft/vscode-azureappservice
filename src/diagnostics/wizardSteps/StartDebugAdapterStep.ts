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
        const siteName = util.extractSiteScmSubDomainName(site);

        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(site);

        // Assume the next started debug sessionw is the one we will launch next.
        const startEventHandler = vscode.debug.onDidStartDebugSession(() => {
            startEventHandler.dispose();

            vscode.commands.executeCommand('workbench.view.debug');
        });
        const folder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
        await vscode.debug.startDebugging(folder, {
            type: "jsLogpoints",
            name: siteName,
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
