import { SubscriptionModels } from 'azure-arm-resource';
import * as vscode from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { AzureAccountWrapper } from '../AzureAccountWrapper';
import { UserCancelledError } from '../errors';
import * as util from '../util';
import { WizardBase, WizardStep } from '../wizard';
import {
    ILogPointsDebuggerClient, KuduLogPointsDebuggerClient, MockLogpointsDebuggerClient
} from './logPointsClient';

import WebSiteManagementClient = require('azure-arm-website');
import { CommandRunResult } from './structs/CommandRunResult';
import { IAttachProcessRequest } from './structs/IAttachProcessRequest';
import { IAttachProcessResponse } from './structs/IAttachProcessResponse';
import { IEnumerateProcessResponse } from './structs/IEnumerateProcessResponse';
import { IStartSessionResponse } from './structs/IStartSessionResponse';

const shouldUseMockKuduCall = false;

let logPointsDebuggerClient: ILogPointsDebuggerClient;

if (shouldUseMockKuduCall) {
    logPointsDebuggerClient = new MockLogpointsDebuggerClient();
} else {
    logPointsDebuggerClient = new KuduLogPointsDebuggerClient();
}

// tslint:disable-next-line:export-name
export class LogPointsSessionAttach extends WizardBase {

    public readonly hasSlot: boolean;
    public selectedDeploymentSlot: WebSiteModels.Site;
    public selectedInstance: WebSiteModels.SiteInstance;
    public sessionId: string;
    public processId: string;
    public debuggerId: string;

    private _cachedPublishCredential: WebSiteModels.User;

    constructor(output: vscode.OutputChannel,
                readonly azureAccount: AzureAccountWrapper,
                readonly site: WebSiteModels.Site,
                readonly subscription?: SubscriptionModels.Subscription
    ) {
        super(output);
    }

    public get lastUsedPublishCredential(): WebSiteModels.User {
        return this._cachedPublishCredential;
    }

    public get webManagementClient(): WebSiteManagementClient {
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

    protected initSteps(): void {
        if (util.isSiteDeploymentSlot(this.site)) {
            this.selectedDeploymentSlot = this.site;
        } else {
            this.steps.push(new PromptSlotSelection(this, this.site));
        }

        this.steps.push(new GetUnoccupiedInstance(this));
        this.steps.push(new PickProcessStep(this));
        this.steps.push(new SessionAttachStep(this));
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

class PromptSlotSelection extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach, readonly site: WebSiteModels.Site) {
        super(_wizard, 'Choose a deployment slot.');
    }

    public async prompt(): Promise<void> {
        let deploymentSlots: WebSiteModels.Site[];

        // Decide if this AppService uses deployment slots
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = 'Enumerating deployment slots for the App Service...';
            p.report({ message: message });
            this._wizard.writeline(message);
            deploymentSlots = await this.getDeploymentSlots();
        });

        this._wizard.writeline(`Got ${deploymentSlots.length} deployment slot(s)`);

        // if there is only one slot, just use that one and don't prompt for user selection.
        if (deploymentSlots.length === 1) {
            this._wizard.selectedDeploymentSlot = deploymentSlots[0];
            this._wizard.writeline(`Automatically selected deployment solt ${this._wizard.selectedDeploymentSlot.name}.`);
            return;
        }

        const deploymentQuickPickItems = deploymentSlots.map((deploymentSlot: WebSiteModels.Site) => {
            return <util.IQuickPickItemWithData<WebSiteModels.Site>>{
                label: util.extractDeploymentSlotName(deploymentSlot) || deploymentSlot.name,
                description: '',
                data: deploymentSlot
            };
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
        const allDeploymentSlots = await client.webApps.listByResourceGroup(this.site.resourceGroup, { includeSlots: true });
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
        const selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;

        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let instances: WebSiteModels.WebAppInstanceCollection;
        const client = this._wizard.webManagementClient;

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

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? `-${util.extractDeploymentSlotName(selectedSlot)}` : '');

        for (const instance of instances) {
            let result: CommandRunResult<IStartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                const message = `Trying to start a session from instance ${instance.name}...`;
                p.report({ message: message });
                this._wizard.writeline(message);
                await logPointsDebuggerClient.startSession(siteName, instance.name, publishCredential)
                    .then((r: CommandRunResult<IStartSessionResponse>) => {
                        result = r;
                    },    () => {
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
            const errorMessage = `There is no instance available to debug for ${selectedSlot.name}.`;
            vscode.window.showErrorMessage(errorMessage);
            throw new Error(errorMessage);
        }
    }
}

// tslint:disable-next-line:max-classes-per-file
class PickProcessStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Enumerate node processes.');
    }

    public async prompt(): Promise<void> {
        const selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        const instance = this._wizard.selectedInstance;
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<IEnumerateProcessResponse>;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Enumerate node processes from instance ${instance.name}...`;
            p.report({ message: message });
            this._wizard.writeline(message);
            const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? `-util.extractDeploymentSlotName(selectedSlot)` : '');
            result = await logPointsDebuggerClient.enumerateProcesses(siteName, instance.name, publishCredential);
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

// tslint:disable-next-line:max-classes-per-file
class SessionAttachStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Attach to node process.');
    }

    public async execute(): Promise<void> {
        const selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        const instance = this._wizard.selectedInstance;
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(selectedSlot);

        let result: CommandRunResult<IAttachProcessResponse>;
        const requestData: IAttachProcessRequest = { sessionId: this._wizard.sessionId, processId: this._wizard.processId };

        const siteName = util.extractSiteName(selectedSlot) + (util.isSiteDeploymentSlot(selectedSlot) ? `-${util.extractDeploymentSlotName(selectedSlot)}` : '');

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            const message = `Attach debugging to session ${this._wizard.sessionId}...`;
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

// tslint:disable-next-line:max-classes-per-file
class StartDebugAdapterStep extends WizardStep {
    constructor(private _wizard: LogPointsSessionAttach) {
        super(_wizard, 'Start debug adapater.');
    }

    public async execute(): Promise<void> {
        const site = this._wizard.selectedDeploymentSlot;
        const siteName = util.extractSiteName(site) + (util.isSiteDeploymentSlot(site) ? `-${util.extractDeploymentSlotName(site)}` : '');
        const publishCredential = await this._wizard.getCachedCredentialOrRefetch(site);

        // Assume the next started debug sessionw is the one we will launch next.
        const startEventHandler = vscode.debug.onDidStartDebugSession(() => {
            startEventHandler.dispose();

            vscode.commands.executeCommand('workbench.view.debug');
        });
        await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
            type: "jsLogpoints",
            name: "Azure App Service LogPoints",
            request: "attach",
            trace: true,
            siteName: siteName,
            publishCredentialUsername: publishCredential.publishingUserName,
            publishCredentialPassword: publishCredential.publishingPassword,
            instanceId: this._wizard.selectedInstance.name,
            sessionId: this._wizard.sessionId,
            debugId: this._wizard.debuggerId
        });

        this._wizard.writeline("Debug session started.");
    }
}
