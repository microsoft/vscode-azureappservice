/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { SiteClient } from 'vscode-azureappservice';

export class StartDebugAdapterStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Start debug adapater.');
    }

    public async execute(): Promise<void> {
        const client: SiteClient = this._wizard.selectedDeploymentSlot;

        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(client);

        // Assume the next started debug sessionw is the one we will launch next.
        const startEventHandler = vscode.debug.onDidStartDebugSession(() => {
            startEventHandler.dispose();

            vscode.commands.executeCommand('workbench.view.debug');
        });
        const folder = undefined; // For logpoints scenarios, workspace folder is always undefined
        await vscode.debug.startDebugging(folder, {
            type: "jsLogpoints",
            name: client.fullName,
            request: "attach",
            trace: true,
            siteName: client.fullName,
            publishCredentialUsername: publishCredential.publishingUserName,
            publishCredentialPassword: publishCredential.publishingPassword,
            instanceId: this._wizard.selectedInstance.name,
            sessionId: this._wizard.sessionId,
            debugId: this._wizard.debuggerId
        });

        this._wizard.writeline("Debug session started.");
    }
}
