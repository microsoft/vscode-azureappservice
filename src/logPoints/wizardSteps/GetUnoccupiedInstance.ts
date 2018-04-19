/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebAppInstanceCollection } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { callWithTimeout, DEFAULT_TIMEOUT } from '../../utils/logpointsUtil';
import { WizardStep } from '../../wizard';
import { ILogPointsDebuggerClient } from '../logPointsClient';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { CommandRunResult } from '../structs/CommandRunResult';
import { IStartSessionRequest } from '../structs/IStartSessionRequest';
import { IStartSessionResponse } from '../structs/IStartSessionResponse';

export class GetUnoccupiedInstance extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, private _logPointsDebuggerClient: ILogPointsDebuggerClient) {
        super(_wizard, 'Find the first available unoccupied instance.');
    }

    public async prompt(): Promise<void> {
        const selectedSlot = (<LogPointsSessionWizard>this.wizard).selectedDeploymentSlot;

        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let instances: WebAppInstanceCollection;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Enumerating instances of ${selectedSlot.fullName}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            instances = await this._wizard.client.listInstanceIdentifiers();

            this._wizard.writeline(`Got ${instances.length} instances.`);
        });

        instances = instances.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        const startSessionRequest: IStartSessionRequest = { username: this._wizard.uiTreeItem.userId };

        for (const instance of instances) {
            let result: CommandRunResult<IStartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                const message = `Trying to start a session from instance ${instance.name}...`;
                p.report({ message: message });
                this._wizard.writeline(message);

                try {
                    result = await callWithTimeout(
                        () => {
                            return this._logPointsDebuggerClient.startSession(selectedSlot.fullName, instance.name, publishCredential, startSessionRequest);
                        },
                        DEFAULT_TIMEOUT);
                } catch (e) {
                    // If there is an error, mark the request failed by resetting `result`.
                    result = null;
                }
            });

            if (result && result.isSuccessful()) {
                this._wizard.selectedInstance = instance;
                this._wizard.sessionId = result.json.data.debuggingSessionId;

                this._wizard.writeline(`Selected instance ${instance.name}`);

                break;
            }
        }

        if (!this._wizard.selectedInstance) {
            const errorMessage = `There is no instance available to debug for ${selectedSlot.fullName}.`;
            vscode.window.showErrorMessage(errorMessage);
            throw new Error(errorMessage);
        }
    }
}
