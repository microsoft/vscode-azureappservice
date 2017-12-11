import { Site, SiteInstance, User } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import * as util from '../util';
import { WizardBase } from '../wizard';
import { createDefaultClient } from './logPointsClient';

import WebSiteManagementClient = require('azure-arm-website');

import { IAzureNode } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { ActivateSite } from './wizardSteps/ActivateSite';
import { CheckLogStreamAvailability } from './wizardSteps/CheckLogStreamAvailability';
import { EligibilityCheck } from './wizardSteps/EligibilityCheck';
import { GetUnoccupiedInstance } from './wizardSteps/GetUnoccupiedInstance';
import { PickProcessStep } from './wizardSteps/PickProcessStep';
import { PromptSlotSelection } from './wizardSteps/PromptSlotSelection';
import { SessionAttachStep } from './wizardSteps/SessionAttachStep';
import { StartDebugAdapterStep } from './wizardSteps/StartDebugAdapterStep';

const logPointsDebuggerClient = createDefaultClient();

// tslint:disable-next-line:export-name
export class LogPointsSessionWizard extends WizardBase {

    public readonly hasSlot: boolean;
    public selectedDeploymentSlot: Site;
    public selectedInstance: SiteInstance;
    public sessionId: string;
    public processId: string;
    public debuggerId: string;
    public readonly site: Site;

    private _cachedPublishCredential: User;

    constructor(
        output: vscode.OutputChannel,
        public readonly uiTreeItem: IAzureNode<SiteTreeItem>,
        public readonly websiteManagementClient: WebSiteManagementClient
    ) {
        super(output);
        this.site = uiTreeItem.treeItem.site;
    }

    public get lastUsedPublishCredential(): User {
        return this._cachedPublishCredential;
    }

    public async fetchPublishCrentential(site: Site): Promise<User> {
        const siteClient = this.websiteManagementClient;
        const user = await util.getWebAppPublishCredential(siteClient, site);
        this._cachedPublishCredential = user;
        return user;
    }

    public async getCachedCredentialOrRefetch(site: Site): Promise<User> {
        if (this.lastUsedPublishCredential) {
            return Promise.resolve(this.lastUsedPublishCredential);
        }

        return this.fetchPublishCrentential(site);
    }

    protected initSteps(): void {
        this.steps.push(new CheckLogStreamAvailability(this));
        this.steps.push(new EligibilityCheck(this));
        if (util.isSiteDeploymentSlot(this.site)) {
            this.selectedDeploymentSlot = this.site;
        } else {
            this.steps.push(new PromptSlotSelection(this, this.site));
        }

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
