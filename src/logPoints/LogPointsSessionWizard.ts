/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteInstance, User } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { WizardBase } from '../wizard';
import { createDefaultClient } from './logPointsClient';
import { IAzureNode } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { LogPointsManager } from './LogPointsManager';
import { ActivateSite } from './wizardSteps/ActivateSite';
import { EligibilityCheck } from './wizardSteps/EligibilityCheck';
import { GetUnoccupiedInstance } from './wizardSteps/GetUnoccupiedInstance';
import { OpenStreamingLog } from './wizardSteps/OpenStreamingLog';
import { PickProcessStep } from './wizardSteps/PickProcessStep';
import { PromptSlotSelection } from './wizardSteps/PromptSlotSelection';
import { SessionAttachStep } from './wizardSteps/SessionAttachStep';
import { StartDebugAdapterStep } from './wizardSteps/StartDebugAdapterStep';
import TelemetryReporter from 'vscode-extension-telemetry';
import { SiteClient } from 'vscode-azureappservice';

const logPointsDebuggerClient = createDefaultClient();

// tslint:disable-next-line:export-name
export class LogPointsSessionWizard extends WizardBase {

    public readonly hasSlot: boolean;
    public selectedDeploymentSlotTreeItem: SiteTreeItem;
    public selectedInstance: SiteInstance;
    public sessionId: string;
    public processId: string;
    public debuggerId: string;

    private _cachedPublishCredential: User;

    constructor(
        public logpointsManager: LogPointsManager,
        public extensionContext: vscode.ExtensionContext,
        output: vscode.OutputChannel,
        public readonly uiTreeItem: IAzureNode<SiteTreeItem>,
        public readonly client: SiteClient,
        public readonly telemetryReporter: TelemetryReporter
    ) {
        super(output);
    }

    public get selectedDeploymentSlot(): SiteClient {
        return this.selectedDeploymentSlotTreeItem ? this.selectedDeploymentSlotTreeItem.client : null;
    }

    public get lastUsedPublishCredential(): User {
        return this._cachedPublishCredential;
    }

    public async fetchPublishCrentential(client: SiteClient): Promise<User> {
        const user = await client.getWebAppPublishCredential();
        this._cachedPublishCredential = user;
        return user;
    }

    public async getCachedCredentialOrRefetch(client: SiteClient): Promise<User> {
        if (this.lastUsedPublishCredential) {
            return Promise.resolve(this.lastUsedPublishCredential);
        }

        return this.fetchPublishCrentential(client);
    }

    protected initSteps(): void {
        this.steps.push(new EligibilityCheck(this));
        if (this.client.isSlot) {
            this.selectedDeploymentSlotTreeItem = this.uiTreeItem.treeItem;
        } else {
            this.steps.push(new PromptSlotSelection(this, this.client));
        }

        this.steps.push(new OpenStreamingLog(this));
        this.steps.push(new ActivateSite(this));
        this.steps.push(new GetUnoccupiedInstance(this, logPointsDebuggerClient));
        this.steps.push(new PickProcessStep(this, logPointsDebuggerClient));
        this.steps.push(new SessionAttachStep(this, logPointsDebuggerClient));
        this.steps.push(new StartDebugAdapterStep(this));
        this.output.show();
    }

    protected onExecuteError(error: Error): void {
        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Starting Log Points Session failed - ${error.message}`);
        this.writeline('');
    }
}
