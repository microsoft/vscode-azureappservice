var req = require("request");
import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as util from './util';
import { UserCancelledError } from './errors';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import { WizardBase, WizardStep, QuickPickItemWithData } from './wizard';

import WebSiteManagementClient = require('azure-arm-website');

let shouldUseMockKuduCall = true;

interface LogPointsDebuggerClient {
    call<ResponseType>(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    startSession(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<StartSessionResponse>>;

    enumerateProcesses(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>>;

    attachProcess(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<AttachProcessResponse>>;
}

abstract class LogPointsDebuggerClientBase {
    abstract call<ResponseType>(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>>;

    protected makeCallAndLogException<ResponseType>(site: WebSiteModels.Site, affinityValue: string,
        publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        return this.call<ResponseType>(site, affinityValue, publishCredential, command)
            .catch<CommandRunResult<ResponseType>>((err) => {
                util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                throw err;
            });;
    }
}

class KuduLogPointsDebuggerClient extends LogPointsDebuggerClientBase implements LogPointsDebuggerClient {
    startSession(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User)
        : Promise<CommandRunResult<StartSessionResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<StartSessionResponse>(site, affinityValue, publishCredential, "node -v");
    }

    enumerateProcesses(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<EnumerateProcessResponse>(site, affinityValue, publishCredential, "node -v");
    }

    attachProcess(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<AttachProcessResponse>> {
        // TODO: The actual command is TBD
        return this.makeCallAndLogException<AttachProcessResponse>(site, affinityValue, publishCredential, "node -v");
    }

    call<ResponseType>(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, command: string)
        : Promise<CommandRunResult<ResponseType>> {
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
        let promise = new Promise<CommandRunResult<ResponseType>>((resolve, reject) => {
            cb = (err, body?, response?) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode}: ${body}`));
                    return;
                }

                resolve(new CommandRunResult<ResponseType>(body.Error, body.ExitCode, body.Output));
            }
        });

        r.post({
            uri: "/api/command",
            json: {
                command: command,
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
}

class MockLogpointsDebuggerClient extends LogPointsDebuggerClientBase implements LogPointsDebuggerClient {
    startSession(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<StartSessionResponse>> {
        return this.makeCallAndLogException<StartSessionResponse>(site, affinityValue, publishCredential, "curl -X POST http://localhost:32923/debugger/session");
    }

    enumerateProcesses(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User): Promise<CommandRunResult<EnumerateProcessResponse>> {
        return this.makeCallAndLogException<EnumerateProcessResponse>(site, affinityValue, publishCredential, "curl -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }

    attachProcess(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, data: AttachProcessRequest): Promise<CommandRunResult<AttachProcessResponse>> {
        return this.makeCallAndLogException<AttachProcessResponse>(site, affinityValue, publishCredential,
            `curl -X POST -H "Content-Type: application/json" -d '{"processId":"${data.processId}","codeType":"javascript"}' http://localhost:32923/debugger/session/${data.processId}/debugee`);
    }

    call<ResponseType>(site: WebSiteModels.Site, affinityValue: string, publishCredential: WebSiteModels.User, command: string): Promise<CommandRunResult<ResponseType>> {
        site && affinityValue && publishCredential;

        return new Promise<CommandRunResult<ResponseType>>((resolve) => {
            child_process.exec(command, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    resolve(new CommandRunResult<ResponseType>(error, error.code, stderr));
                    return;
                }

                resolve(new CommandRunResult<ResponseType>(null, 0, stdout));
            });
        });
    }
}

let logPointsDebuggerClient: LogPointsDebuggerClient;

if (shouldUseMockKuduCall) {
    logPointsDebuggerClient = new MockLogpointsDebuggerClient();
} else {
    logPointsDebuggerClient = new KuduLogPointsDebuggerClient();
}

class CommandRunResult<ResponseType extends { error?: any, data?: any }> {
    private _json: ResponseType;
    constructor(public error: any, public exitCode: number, public output: string) {
        this._json = undefined;
    }

    isSuccessful() {
        return this.exitCode === 0 && this.json && !this.json.error;
    }

    get json(): ResponseType {
        if (this._json === undefined) {
            try {
                this._json = JSON.parse(this.output);
            } catch (err) {
                util.getOutputChannel().appendLine(`API call error ${err.toString()}`);
                this._json == null;
            }
        }

        return this._json;
    };
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

        for (let instance of instances) {
            let result: CommandRunResult<StartSessionResponse>;

            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
                p.report({ message: `Trying to start a session from instance ${instance.name}...` });
                await logPointsDebuggerClient.startSession(selectedSlot, instance.name, publishCredential)
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
                this._wizard.sessionId = result.json.data._id;
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
            result = await logPointsDebuggerClient.enumerateProcesses(selectedSlot, instance.name, publishCredential);
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

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async p => {
            p.report({ message: `Attach debugging to session ${this._wizard.sessionId}...` });
            result = await logPointsDebuggerClient.attachProcess(selectedSlot, instance.name, publishCredential, requestData);
        });

        if (result.isSuccessful()) {
            this._wizard.debuggerId = result.json.data;
            vscode.window.showInformationMessage(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
        } else {
            throw new Error('Attaching process failed.');
        }
    }
}


class AttachProcessRequest {
    constructor(public sessionId: string, public processId: string) {
    }
}

interface StartSessionResponse {
    data: {
        _debugIds: any[];
        _id: string;
        _user: any;
    }
}

interface EnumerateProcessResponse {
    data: {
        pid: string;
        command: string;
        arguments: string[];
    }[]
}

interface AttachProcessResponse {
    data: string
}
