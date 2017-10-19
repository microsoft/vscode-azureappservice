var req = require("request");
import * as vscode from 'vscode';
import * as util from './util';
import { UserCancelledError } from './errors';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { WizardBase, WizardStep, QuickPickItemWithData } from './wizard';

import WebSiteManagementClient = require('azure-arm-website');

let shouldUseMockupKuduCall = false;

async function makeKuduCall(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, request: KuduRequestBase): Promise<CommandRunResult> {
    let promise: Promise<CommandRunResult>;
    if (shouldUseMockupKuduCall) {
        promise = mockupKuduCall(site, affinityValue, publishCredential, request);
    } else {
        promise = realKuduCall(site, affinityValue, publishCredential, request);
    }

    return promise.catch<CommandRunResult>((err) => {
        util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
        throw err;
    });
}

interface CommandRunResult {
    Error: any
    ExitCode: number
    Output: string
}

async function realKuduCall(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, request: KuduRequestBase): Promise<CommandRunResult> {
    const siteName = util.extractSiteName(site) + (util.isSiteDeploymentSlot(site) ? '-' + util.extractDeploymentSlotName(site) : '');

    let headers = {
        "Authorization": "Basic " +
        new Buffer(publishCredential.publishingUserName + ":" + publishCredential.publishingPassword)
            .toString("base64")
    };

    var r = req.defaults({
        baseUrl: "https://" + siteName + ".scm.azurewebsites.net/",
        headers: headers,
    });

    r.cookie(`ARRAffinity=${affinityValue}`);
    let cb: (err, body?, response?) => void;
    let promise = new Promise<CommandRunResult>((resolve, reject) => {
        cb = (err, body?, response?) => {
            if (err) {
                reject(err);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`${response.statusCode}: ${body}`));
                return;
            }

            resolve({
                Error: body.Error,
                ExitCode: body.ExitCode,
                Output: body.Output
            });
        }
    });

    r.post({
        uri: "/api/command",
        json: {
            command: request.command,
            dir: '/'
        }
    }, function execCallback(err, response, body) {
        if (err) {
            return cb(err);
        }

        cb(null, body, response);
    });

    return promise;
}

async function mockupKuduCall(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, request: KuduRequestBase): Promise<CommandRunResult> {
    site && affinityValue && publishCredential && request;

    return new Promise<CommandRunResult>((resolve) => {
        resolve({
            Error: null,
            ExitCode: 0,
            Output: ''
        });
    })
}

export class LogPointsSessionAttach extends WizardBase {
    private _cachedPublishCredential: WebSiteModels.User

    readonly hasSlot: boolean;
    selectedDeploymentSlot: WebSiteModels.Site
    selectedInstance: WebSiteModels.SiteInstance

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
        super(_wizard, 'Choose a deployment slot.');
    }

    async execute(): Promise<void> {
        let selectedSlot = (<LogPointsSessionAttach>this.wizard).selectedDeploymentSlot;
        vscode.window.showInformationMessage("The deployment slot you selected is: " + selectedSlot.name);

        let publishCredential = this._wizard.lastUsedPublishCredential || await this._wizard.fetchPublishCrentential(selectedSlot);

        let instances: WebSiteModels.WebAppInstanceCollection;
        const client = this._wizard.webManagementClient;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: `Enumerating instances of ${selectedSlot.name}...` });
            instances = await client.webApps.listInstanceIdentifiers(selectedSlot.resourceGroup, selectedSlot.name);
        });

        instances = instances.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        for (let instance of instances) {
            let result: CommandRunResult;
            let request = new StartSessionRequest();

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: `Trying to start a session from instance ${instance.name}...` });
                await makeKuduCall(selectedSlot, instance.name, publishCredential, request).then((r: CommandRunResult) => {
                    result = r;
                }, () => {
                    // If there is an error, mark the request failed by resetting `result`.
                    result = null;
                });
            });

            // TODO: JSON-parse result.output and see what it really means.
            if (result && result.ExitCode == 0) {
                vscode.window.showInformationMessage(`The command ${request.command} ran, and the result is ${result.Output}`);
                this._wizard.selectedInstance = instance;
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
    constructor(wizard: WizardBase) {
        super(wizard, 'Start.');
    }

    async execute(): Promise<void> {

        // TODO issue command to get a list of processes.
    }
}

class SessionAttachStep extends WizardStep {
    constructor(wizard: WizardBase) {
        super(wizard, 'Start.');
    }

    async execute(): Promise<void> {
        // TODO: Call Agent API to open debugging port
    }
}

class KuduRequestBase {
    get command(): string {
        throw Error('unimplemented');
    }
    constructor(public name: string, public parameters: any) {
    }
}

class StartSessionRequest extends KuduRequestBase {
    constructor() {
        super('startSession', {});
    }

    get command() {
        return 'node -v';
    }
}
