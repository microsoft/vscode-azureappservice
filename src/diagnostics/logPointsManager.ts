import * as vscode from 'vscode';
import * as util from '../util';
import { UserCancelledError } from '../errors';
import { AzureAccountWrapper } from '../azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { WizardBase, WizardStep, QuickPickItemWithData } from '../wizard';
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

    public readonly hasSlot: boolean;
    public selectedDeploymentSlot: WebSiteModels.Site;
    public selectedInstance: WebSiteModels.SiteInstance;
    public sessionId: string;
    public processId: string;
    public debuggerId: string;

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

    public get lastUsedPublishCredential(): WebSiteModels.User {
        return this._cachedPublishCredential;
    }

    public get webManagementClient() {
        return new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
    }

    public async fetchPublishCrentential(site: WebSiteModels.Site): Promise<WebSiteModels.User> {
        const siteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        const user = await util.getWebAppPublishCredential(siteClient, site);
        this._cachedPublishCredential = user;
        return user;
    }

    public async getCachedCredentialOrRefetch(site: WebSiteModels.Site): Promise<WebSiteModels.User> {
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
        this.writeline(`Starting Log Points Session failed - ${error.message}`);
        this.writeline('');
    }
}

class PromptSlotSelection extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach, readonly site: WebSiteModels.Site) {
        super(_wizard, 'Choose a deployment slot.');
    }

    public async prompt(): Promise<void> {
        let deploymentSlots: WebSiteModels.Site[];

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            let message = 'Enumerating deployment slots for the App Service...';
            p.report({ message: message });
            this._wizard.writeline(message);
            deploymentSlots = await this.getDeploymentSlots();
        });

        this._wizard.writeline(`Got ${deploymentSlots.length} deployment slot(s)`);

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlots.length == 1) {
            this._wizard.selectedDeploymentSlot = deploymentSlots[0];
            this._wizard.writeline(`Automatically selected deployment solt ${this._wizard.selectedDeploymentSlot.name}.`);
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
        let pickedItem;
        try {
            pickedItem = await this.showQuickPick(deploymentQuickPickItems, quickPickOption);
        } catch (e) {
            if (e instanceof UserCancelledError) {
                vscode.window.showInformationMessage('Please select a deployment slot.');
            }
            throw e;
        }

        this._wizard.selectedDeploymentSlot = pickedItem.data;
        this._wizard.writeline(`The deployment slot you selected is: ${this._wizard.selectedDeploymentSlot.name}`);
    }
    /**
     * Returns all the deployment slots and the production slot.
     */
    private async getDeploymentSlots(): Promise<WebSiteModels.Site[]> {
        const client = this._wizard.webManagementClient;
        let allDeploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
        return allDeploymentSlots.filter((slot) => {
            return slot.repositorySiteName === this.site.name;
        });
    }
}

class GetUnoccupiedInstance extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Find the first available unoccupied instance.');
    }

    public async prompt(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;

        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let instances: WebSiteModels.WebAppInstanceCollection;
        const client = this._wizard.webManagementClient;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            let message = `Enumerating instances of ${selectedSlot.name}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            instances = await client.webApps.listInstanceIdentifiers(selectedSlot.resourceGroup, selectedSlot.repositorySiteName);

            this._wizard.writeline(`Got ${instances.length} instances.`);
        });

        instances = instances.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');

        for (let instance of instances) {
            let result: CommandRunResult<StartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                let message = `Trying to start a session from instance ${instance.name}...`;
                p.report({ message: message });
                this._wizard.writeline(message);
                await logPointsDebuggerClient.startSession(siteName, instance.name, publishCredential)
                    .then((r: CommandRunResult<StartSessionResponse>) => {
                        result = r;
                    }, () => {
                        // If there is an error, mark the request failed by resetting `result`.
                        result = null;
                    });
            });

            if (result && result.isSuccessful()) {
                this._wizard.selectedInstance = instance;
                this._wizard.sessionId = result.json.data.debuggingSessionId;

                this._wizard.writeline(`Selected instance ${instance.name}`);

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

    public async prompt(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        let instance = this._wizard.selectedInstance;
        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<EnumerateProcessResponse>;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            let message = `Enumerate node processes from instance ${instance.name}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');
            result = await logPointsDebuggerClient.enumerateProcesses(siteName, instance.name, publishCredential);
        });

        if (!result.isSuccessful() || result.json.data.length == 0) {
            throw new Error('Enumerating processes failed.');
        }

        // Show a quick pick list (even if there is only 1 process)
        let quickPickItems: QuickPickItemWithData<string>[] = result.json.data.map((process) => {
            return <QuickPickItemWithData<string>>{
                label: `${process.pid}`,
                description: ` ${process.command} `
                + ` ${typeof process.arguments == 'string' ? process.arguments : process.arguments.join(' ')}`,
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

class SessionAttachStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Attach to node process.');
    }

    public async execute(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        let instance = this._wizard.selectedInstance;
        let publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<AttachProcessResponse>;
        let requestData = new AttachProcessRequest(this._wizard.sessionId, this._wizard.processId);

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? '-' + util.extractDeploymentSlotName(selectedSlot) : '');

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            let message = `Attach debugging to session ${this._wizard.sessionId}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            result = await logPointsDebuggerClient.attachProcess(siteName, instance.name, publishCredential, requestData);
        });

        if (result.isSuccessful()) {
            this._wizard.debuggerId = result.json.data.debugeeId;
            this._wizard.writeline(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
        } else {
            throw new Error('Attaching process failed.');
        }
    }
}

class StartDebugAdapterStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Start debug adapater.');
    }

    public async execute(): Promise<void> {
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

        this._wizard.writeline("Debug session started.");
    }
}
