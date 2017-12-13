
import { WebAppInstanceCollection } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import * as util from '../../util';
import { callWithTimeout, DEFAULT_TIMEOUT } from '../../utils/logpointsUtil';
import { WizardStep } from '../../wizard';
import { ILogPointsDebuggerClient } from '../logPointsClient';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { CommandRunResult } from '../structs/CommandRunResult';
import { IStartSessionResponse } from '../structs/IStartSessionResponse';

export class GetUnoccupiedInstance extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard, private _logPointsDebuggerClient: ILogPointsDebuggerClient) {
        super(_wizard, 'Find the first available unoccupied instance.');
    }

    public async prompt(): Promise<void> {
        const selectedSlot = (<LogPointsSessionWizard>this.wizard).selectedDeploymentSlot;

        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let instances: WebAppInstanceCollection;
        const client = this._wizard.websiteManagementClient;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Enumerating instances of ${selectedSlot.name}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            instances = await client.webApps.listInstanceIdentifiers(selectedSlot.resourceGroup, selectedSlot.repositorySiteName);

            this._wizard.writeline(`Got ${instances.length} instances.`);
        });

        instances = instances.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        const siteName = util.extractSiteScmSubDomainName(selectedSlot);

        for (const instance of instances) {
            let result: CommandRunResult<IStartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                const message = `Trying to start a session from instance ${instance.name}...`;
                p.report({ message: message });
                this._wizard.writeline(message);

                try {
                    result = await callWithTimeout(
                        () => {
                            return this._logPointsDebuggerClient.startSession(siteName, instance.name, publishCredential);
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
            const errorMessage = `There is no instance available to debug for ${selectedSlot.name}.`;
            vscode.window.showErrorMessage(errorMessage);
            throw new Error(errorMessage);
        }
    }
}
