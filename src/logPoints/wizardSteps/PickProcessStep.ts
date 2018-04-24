/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../../util';
import { callWithTimeout, DEFAULT_TIMEOUT } from '../../utils/logpointsUtil';
import { WizardStep } from '../../wizard';
import { ILogPointsDebuggerClient } from '../logPointsClient';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { CommandRunResult } from '../structs/CommandRunResult';
import { IEnumerateProcessResponse } from '../structs/IEnumerateProcessResponse';

export class PickProcessStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, private _logPointsDebuggerClient: ILogPointsDebuggerClient) {
        super(_wizard, 'Enumerate node processes.');
    }

    public async prompt(): Promise<void> {
        const selectedSlot = (<LogPointsSessionWizard>this.wizard).selectedDeploymentSlot;
        const instance = this._wizard.selectedInstance;
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<IEnumerateProcessResponse>;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Enumerate node processes from instance ${instance.name}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            result = await callWithTimeout(
                () => {
                    return this._logPointsDebuggerClient.enumerateProcesses(selectedSlot.fullName, instance.name, publishCredential);
                },
                DEFAULT_TIMEOUT);
        });

        if (!result.isSuccessful() || result.json.data.length === 0) {
            throw new Error('Enumerating processes failed.');
        }

        // Show a quick pick list (even if there is only 1 process)
        const quickPickItems: util.IQuickPickItemWithData<string>[] = result.json.data.map((process) => {
            return <util.IQuickPickItemWithData<string>>{
                label: `${process.pid}`,
                description: ` ${process.command} `
                    + ` ${typeof process.arguments === 'string' ? process.arguments : process.arguments.join(' ')}`,
                data: process.pid
            };
        });

        const quickPickOption = { placeHolder: `Please select a Node.js process to attach to: (${this.stepProgressText})` };

        let pickedProcess;
        try {
            pickedProcess = await this.showQuickPick(quickPickItems, quickPickOption);
        } catch (e) {
            if (e instanceof UserCancelledError) {
                vscode.window.showInformationMessage('Please select a node process to debug.');
            }
            throw e;
        }

        this._wizard.processId = pickedProcess.data;

        this._wizard.writeline(`Selected process ${this._wizard.processId}. "${pickedProcess.description}"`);
    }
}
