/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { callWithTimeout, DEFAULT_TIMEOUT } from '../../utils/logpointsUtil';
import { WizardStep } from '../../wizard';
import { ILogPointsDebuggerClient } from '../logPointsClient';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { CommandRunResult } from '../structs/CommandRunResult';
import { IAttachProcessRequest } from '../structs/IAttachProcessRequest';
import { IAttachProcessResponse } from '../structs/IAttachProcessResponse';

export class SessionAttachStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, private _logPointsDebuggerClient: ILogPointsDebuggerClient) {
        super(_wizard, 'Attach to node process.');
    }

    public async execute(): Promise<void> {
        const selectedSlot = (<LogPointsSessionWizard>this.wizard).selectedDeploymentSlot!; // non-null behavior unknown. Should be handled by logPoints team
        const instance = this._wizard.selectedInstance;
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        const requestData: IAttachProcessRequest = { sessionId: this._wizard.sessionId, processId: this._wizard.processId };

        let result: CommandRunResult<IAttachProcessResponse> = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Attach debugging to session ${this._wizard.sessionId}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            return await callWithTimeout(
                () => {
                    return this._logPointsDebuggerClient.attachProcess(selectedSlot.fullName, instance.name!, publishCredential, requestData); // non-null behavior unknown. Should be handled by logPoints team
                },
                DEFAULT_TIMEOUT);
        });

        if (result.isSuccessful()) {
            this._wizard.debuggerId = result.json!.data.debugeeId; // non-null behavior unknown. Should be handled by logPoints team
            this._wizard.writeline(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
        } else {
            throw new Error(`Attached to process ${this._wizard.processId} failed, got response ${result.json!.error!.message}`); // non-null behavior unknown. Should be handled by logPoints team
        }
    }
}
