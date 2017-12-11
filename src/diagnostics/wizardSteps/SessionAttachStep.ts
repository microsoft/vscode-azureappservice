import * as vscode from 'vscode';
import * as util from '../../util';
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
        const selectedSlot = (<LogPointsSessionWizard>this.wizard).selectedDeploymentSlot;
        const instance = this._wizard.selectedInstance;
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<IAttachProcessResponse>;
        const requestData: IAttachProcessRequest = { sessionId: this._wizard.sessionId, processId: this._wizard.processId };

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? `-${util.extractDeploymentSlotName(selectedSlot)}` : '');

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Attach debugging to session ${this._wizard.sessionId}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            result = await callWithTimeout(
                () => {
                    return this._logPointsDebuggerClient.attachProcess(siteName, instance.name, publishCredential, requestData);
                },
                DEFAULT_TIMEOUT);
        });

        if (result.isSuccessful()) {
            this._wizard.debuggerId = result.json.data.debugeeId;
            this._wizard.writeline(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
        } else {
            this._wizard.writeline(`Attached to process ${this._wizard.processId} failed, got response ${result.output}`);
            throw new Error('Attaching process failed.');
        }
    }
}
