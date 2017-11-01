import * as vscode from 'vscode';
import * as util from './util';
import { UserCancelledError } from './errors';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { WizardBase, WizardStep, QuickPickItemWithData } from './wizard';
import {
    LogPointsDebuggerClient, KuduLogPointsDebuggerClient, MockLogpointsDebuggerClient, AttachProcessRequest,
    CommandRunResult, StartSessionResponse, EnumerateProcessResponse, AttachProcessResponse
} from './logPointsClient';

import WebSiteManagementClient = require('azure-arm-website');

let shouldUseMockKuduCall = true;

let logPointsDebuggerClient: LogPointsDebuggerClient;

if (shouldUseMockKuduCall) {
    logPointsDebuggerClient = new MockLogpointsDebuggerClient();
} else {
    logPointsDebuggerClient = new KuduLogPointsDebuggerClient();
}

export class LogPointsSessionAttach extends WizardBase {
    private _cachedPublishCredential: WebSiteModels.User

    readonly hasSlot: boolean;
    selectedDeploymentSlot: WebSiteModels.Site;
    selectedInstance: WebSiteModels.SiteInstance;
    sessionId: string;
    processId: string;
    debuggerId: string;

    constructor(output: vscode.OutputChannel,
        readonly azureAccount: AzureAccountWrapper,
        readonly site: WebSiteModels.Site,
        readonly subscription?: SubscriptionModels.Subscription
    ) {
        super(output);
        if (util.isSiteDeploymentSlot(this.site)) {
            this.selectedDeploymentSlot = this.site;
        } else {
            this.steps.push(new PromptSlotSelection(this, this.site));
        }

        this.steps.push(new GetUnoccupiedInstance(this));
        this.steps.push(new PickProcessStep(this));
        this.steps.push(new SessionAttachStep(this));
        this.steps.push(new StartDebugAdapterStep(this));
    }

    get lastUsedPublishCredential(): WebSiteModels.User {
        return this._cachedPublishCredential;
    }

    get webManagementClient() {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }

    async fetchPublishCrentential(site: WebSiteModels.Site): Promise<WebSiteModels.User> {
        const siteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        const user = await util.getWebAppPublishCredential(siteClient, site);
        this._cachedPublishCredential = user;
        return user;
    }

    async getCachedCredentialOrRefetch(site: WebSiteModels.Site): Promise<WebSiteModels.User> {
        if (this.lastUsedPublishCredential) {
            return Promise.resolve(this.lastUsedPublishCredential);
        }

        return this.fetchPublishCrentential(site);
    }

    protected beforeExecute() { }

    protected onExecuteError(error: Error) {
        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Deployment failed - ${error.message}`);
        this.writeline('');
    }
}

class PromptSlotSelection extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach, readonly site: WebSiteModels.Site) {
        super(_wizard, 'Choose a deployment slot.');
    }

    async execute(): Promise<void> {
        let deploymentSlots: WebSiteModels.WebAppCollection;

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: 'Enumerating deployment slots for the App Service...' });
            deploymentSlots = await this.getDeploymentSlots();
        });

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlots.length == 1) {
            this._wizard.selectedDeploymentSlot = deploymentSlots[0];
            return;
        }

        const deploymentQuickPickItems = deploymentSlots.map((deploymentSlot: WebSiteModels.Site) => {
            return <QuickPickItemWithData<WebSiteModels.Site>>{
                label: util.extractDeploymentSlotName(deploymentSlot) || deploymentSlot.name,
                description: '',
                data: deploymentSlot
            }
        });

        const quickPickOption = { placeHolder: `Please select a deployment slot: (${this.stepProgressText})` };
        const pickedItem = await this.showQuickPick(deploymentQuickPickItems, quickPickOption);

        (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot = pickedItem.data;
    }

    private async getDeploymentSlots(): Promise<WebSiteModels.WebAppCollection> {
        const client = this._wizard.webManagementClient;
        return client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
    }
}

class GetUnoccupiedInstance extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Find the first available unoccupied instance.');
    }

    async execute(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        vscode.window.showInformationMessage("The deployment slot you selected is: " + selectedSlot.name);

        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let instances: WebSiteModels.WebAppInstanceCollection;
        const client = this._wizard.webManagementClient;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: `Enumerating instances of ${selectedSlot.name}...` });
            instances = await client.webApps.listInstanceIdentifiers(selectedSlot.resourceGroup, selectedSlot.name);
        });

        instances = instances.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');

        for (let instance of instances) {
            let result: CommandRunResult<StartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: `Trying to start a session from instance ${instance.name}...` });
                await logPointsDebuggerClient.startSession(siteName, instance.name, publishCredential)
                    .then((r: CommandRunResult<StartSessionResponse>) => {
                        result = r;
                    }, () => {
                        // If there is an error, mark the request failed by resetting `result`.
                        result = null;
                    });
            });

            if (result && result.isSuccessful()) {
                vscode.window.showInformationMessage(`The start session command ran, and the result is ${result.output}`);
                this._wizard.selectedInstance = instance;
                this._wizard.sessionId = result.json.data.debuggingSessionId;
                break;
            }
        }

        if (!this._wizard.selectedInstance) {
            let errorMessage = `There is no instance available to debug for ${selectedSlot.name}.`;
            vscode.window.showErrorMessage(errorMessage);
            throw new Error(errorMessage);
        }
    }
}

class PickProcessStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Enumerate node processes.');
    }

    async execute(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        let instance = this._wizard.selectedInstance;
        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<EnumerateProcessResponse>;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: `Enumerate node processes from instance ${instance.name}...` });
            const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');
            result = await logPointsDebuggerClient.enumerateProcesses(siteName, instance.name, publishCredential);
        });

        if (!result.isSuccessful() || result.json.data.length == 0) {
            throw new Error('Enumerating processes failed.');
        }

        // If there is only 1 process returned, just use that process. Do not show pickup list.
        if (result.json.data.length == 1) {
            this._wizard.processId = result.json.data[0].pid;
            vscode.window.showInformationMessage(`Found 1 process ${this._wizard.processId}, use process ${this._wizard.processId}`);
            return;
        }

        // Otherwise, show a quick pick list
        let quickPickItems: QuickPickItemWithData<string>[] = result.json.data.map((process) => {
            return <QuickPickItemWithData<string>>{
                label: `${process.pid}`,
                description: ` ${process.command} `
                + ` ${typeof process.arguments == 'string' ? process.arguments : process.arguments.join(' ')}`,
                data: process.pid
            };
        });

        const quickPickOption = { placeHolder: `Please select a Node.js process to attach to: (${this.stepProgressText})` };

        let pickedProcess = await this.showQuickPick(quickPickItems, quickPickOption);
        this._wizard.processId = pickedProcess.data;

        vscode.window.showInformationMessage(`Selected process ${this._wizard.processId}. "${pickedProcess.description}"`);
    }
}

class SessionAttachStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Attach to node process.');
    }

    async execute(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        let instance = this._wizard.selectedInstance;
        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<AttachProcessResponse>;
        let requestData = new AttachProcessRequest(this._wizard.sessionId, this._wizard.processId);

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: `Attach debugging to session ${this._wizard.sessionId}...` });
            result = await logPointsDebuggerClient.attachProcess(siteName, instance.name, publishCredential, requestData);
        });

        if (result.isSuccessful()) {
            this._wizard.debuggerId = result.json.data.debugeeId;
            vscode.window.showInformationMessage(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
        } else {
            throw new Error('Attaching process failed.');
        }
    }
}

class StartDebugAdapterStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Start debug adapater.');
    }

    async execute(): Promise<void> {
        let site = this._wizard.selectedDeploymentSlot;
        let siteName = util.extractSiteName(site) + (util.isSiteDeploymentSlot(site) ? '-' + util.extractDeploymentSlotName(site) : '');
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
            type: "jsLogpoints",
            name: "Azure App Service LogPoints",
            request: "attach",
            "trace": true,
            "siteName": siteName,
            "publishCredentialName": "",
            "publishCredentialPassword": "",
            "instanceId": this._wizard.selectedInstance.id,
            "sessionId": this._wizard.sessionId,
            "debugId": this._wizard.debuggerId
        });
    }
}
