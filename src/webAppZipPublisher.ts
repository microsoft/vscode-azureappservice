/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, SubscriptionStepBase, UserCancelledError, QuickPickItemWithData } from './wizard';
import { WebAppCreator } from './webAppCreator';
import { KuduClient, CommandResult } from './kuduClient';
import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export class WebAppZipPublisher extends WizardBase {
    constructor(output: vscode.OutputChannel, 
        readonly azureAccount: AzureAccountWrapper, 
        readonly subscription?: SubscriptionModels.Subscription,
        readonly site?: WebSiteModels.Site,
        readonly zipFilePath?: string,
        readonly folderPath?: string) {
        super(output);
        this.steps.push(new ZipFileStep(this, zipFilePath, folderPath));
        this.steps.push(new SubscriptionStep(this, azureAccount, subscription));
        this.steps.push(new WebAppStep(this, azureAccount, site));
        this.steps.push(new DeployStep(this, azureAccount));
    }

    protected onExecuteError(step: WizardStep, stepIndex: number, error: Error) {
        if (error instanceof UserCancelledError) {
            return;
        }
        this.writeline(`Deployment failed - ${error.message}`);
        this.writeline('');
    }
}

class ZipFileStep extends WizardStep {
    private _zipFilePath: string;
    private _folderPath: string;
    private _zipCreatedByStep = true;

    constructor(wizard: WizardBase,
        zipFilePath?: string,
        folderPath?: string) {
        super(wizard, 'Select or create Zip File');
        this._zipFilePath = zipFilePath;
        this._folderPath = folderPath;
    }

    async prompt(): Promise<void> {
        if (this._zipFilePath) {
            this._zipCreatedByStep = false;
            return;
        }

        if (!this._folderPath) {
            if (!vscode.workspace.workspaceFolders) {
                throw new Error('No open folder.');
            }

            const folderQuickPickItems = vscode.workspace.workspaceFolders.map((value) => {
                {
                    return <QuickPickItemWithData<vscode.WorkspaceFolder>>{
                        label: value.name,
                        description: '',
                        data: value
                    }
                }
            });
            const folderQuickPickOption = { placeHolder: `Select the folder to Zip and deploy. (${this.stepProgressText})` };
            const pickedItem = folderQuickPickItems.length == 1 ? 
                folderQuickPickItems[0] : await this.showQuickPick(folderQuickPickItems, folderQuickPickOption);
            this._folderPath = pickedItem.data.uri.fsPath;
        }

        let deployNumber = Math.floor(os.uptime());
        while (true) {
            this._zipFilePath = path.join(os.tmpdir(), `vscdeploy${deployNumber}.zip`);
            const fileExists = await new Promise<boolean>((resolve, reject) => fs.exists(this._zipFilePath, exists => resolve(exists)));
            if (!fileExists) {
                break;
            }
            deployNumber++;
        }
    }

    async execute(): Promise<void> {
        if (this._zipCreatedByStep) {
            this.wizard.writeline(`Creating Zip file for deployment: ${this.zipFilePath} ...`)
            await this.zipDirectory(this.zipFilePath, this._folderPath, path.sep);
        }
    }

    get zipFilePath(): string {
        return this._zipFilePath;
    }

    get zipCreatedByStep(): boolean {
        return this._zipCreatedByStep;
    }

    private zipDirectory(zipFilePath: string, sourcePath: string, targetPath: string): Promise<void> {
        if (!sourcePath.endsWith(path.sep)) {
            sourcePath += path.sep;
        }
        return new Promise((resolve, reject) =>{
            const zipOutput = fs.createWriteStream(zipFilePath)
            zipOutput.on('close', () => resolve());

            const zipper = archiver('zip', { zlib: { level: 9 }});
            zipper.on('error', err => reject(err));
            zipper.pipe(zipOutput);
            zipper.glob('**/*', { 
                cwd: this._folderPath,
                dot: true, 
                ignore: 'node_modules{,/**}'
            });
            zipper.finalize();
        });
    }
}

class SubscriptionStep extends SubscriptionStepBase {
    constructor(wizard: WizardBase,
        azureAccount: AzureAccountWrapper,
        subscription?: SubscriptionModels.Subscription) {
        super(wizard, 'Select target Subscription', azureAccount, subscription);
    }

    async prompt(): Promise<void> {
        if (!!this.subscription) {
            return;
        }

        const quickPickItems = await this.getSubscriptionsAsQuickPickItems();
        const quickPickOptions = { placeHolder: `Select the subscription where target Web App is. (${this.stepProgressText})` };
        const result = await this.showQuickPick(quickPickItems, quickPickOptions);
        this._subscription = result.data;
    }
}

class WebAppStep extends WizardStep {
    private _site: WebSiteModels.Site;
    private _newSite = false;
    private _createWebAppWizard: WebAppCreator;

    constructor(wizard: WizardBase,
        readonly azureAccount: AzureAccountWrapper,
        site?: WebSiteModels.Site) {
        super(wizard, 'Select or create Web App');
        this._site = site;
    }

    async prompt(): Promise<void> {
        if (!!this.site) {
            return;
        }

        const subscription = this.getSelectedSubscription();
        const websiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        const webApps = await util.listAll(websiteClient.webApps, websiteClient.webApps.list());
        const quickPickItems: QuickPickItemWithData<WebSiteModels.Site>[] = [];
        quickPickItems.push({
            label: '$(plus) Create new Web App',
            description: '',
            data: null
        });
        webApps.forEach(element => {
            if (element.kind.toLowerCase().indexOf('app') >= 0 &&
                element.kind.toLowerCase().indexOf('linux') >= 0) {
                quickPickItems.push({
                    label: element.name,
                    description: `(${element.resourceGroup})`,
                    data: element
                });
            }
        });
        
        const pickedItem = await this.showQuickPick(quickPickItems, { placeHolder: 'Select the target Web App' });
        
        if (pickedItem.data) {
            this._site = pickedItem.data;
            return;
        }

        this._newSite = true;
        this._createWebAppWizard = new WebAppCreator(util.getOutputChannel(), this.azureAccount, subscription);
        const wizardResult = await this._createWebAppWizard.run(true);

        if (wizardResult.status !== 'PromptCompleted') {
            throw wizardResult.error;
        }
    }

    async execute(): Promise<void> {
        if (this._newSite) {
            const result = await this._createWebAppWizard.execute();

            if (result.status !== 'Completed') {
                throw result.error;
            }

            this._site = this._createWebAppWizard.createdWebSite;
        }

        return;
    }

    get site(): WebSiteModels.Site {
        return this._site;
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = <SubscriptionStep>this.wizard.findStep(step => step instanceof SubscriptionStep, 'The Wizard must have a SubscriptionStep.');

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }
}

class DeployStep extends WizardStep {
    constructor(wizard: WizardBase, readonly azureAccount: AzureAccountWrapper) {
        super(wizard, 'Deploy to Web App');
    }

    async execute(): Promise<void> {
        const remoteFolder = 'site/wwwroot/';
        const subscription = this.getSelectedSubscription();
        const site = this.getSelectedWebApp();
        const zipFilePath = this.getSelectedZipFilePath();
        const user = await util.getWebAppPublishCredential(this.azureAccount, subscription, site);
        const kuduClient = new KuduClient(site.name, user.publishingUserName, user.publishingPassword);
        const siteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        
        this.wizard.writeline(`Start Zip deployment to ${site.name}...`);
        this.wizard.writeline('Stopping Web App...');
        await siteClient.webApps.stop(site.resourceGroup, site.name);
        await util.waitForWebSiteState(siteClient, site, 'stopped');

        this.wizard.writeline('Deleting existing deployment...');
        await kuduClient.vfsEmptyDirectory(`/home/${remoteFolder}`);
        await kuduClient.cmdExecute(`mkdir /home/${remoteFolder}`, '/');
        
        this.wizard.writeline('Uploading Zip package...');
        await kuduClient.zipUpload(zipFilePath, remoteFolder);
        this.wizard.writeline('Installing npm packages...');
        const installResult = await kuduClient.cmdExecute(`npm install --production`, remoteFolder);
        this.wizard.writeline(`${installResult.Output}\n${installResult.Error}`);
        
        if (this.isZipCreatedByDeployment()) {
            await new Promise((resolve, reject) => fs.unlink(zipFilePath, err => {
                if (err) {
                    this.wizard.writeline(`Unable to delete the local Zip file "${zipFilePath}", you may want to delete it manually. Error:\n${err}`);
                }
                resolve();
            }));
        }

        this.wizard.writeline('Starting Web App...');
        await siteClient.webApps.start(site.resourceGroup, site.name);
        await util.waitForWebSiteState(siteClient, site, 'running');

        this.wizard.writeline('Deployment completed.');
        this.wizard.writeline('');
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = <SubscriptionStep>this.wizard.findStep(step => step instanceof SubscriptionStep, 'The Wizard must have a SubscriptionStep.');

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }
    
    protected getSelectedWebApp(): WebSiteModels.Site {
        const webAppStep = <WebAppStep>this.wizard.findStep(step => step instanceof WebAppStep, 'The Wizard must have a WebAppStep.');

        if (!webAppStep.site) {
            throw new Error('A Web App must be selected first.');
        }

        return webAppStep.site;
    }

    protected getSelectedZipFilePath(): string {
        const zipFileStep = <ZipFileStep>this.wizard.findStep(step => step instanceof ZipFileStep, 'The Wizard must have a ZipFileStep.');
        
        if (!zipFileStep.zipFilePath) {
            throw new Error('A Zip file must be selected first.');
        }

        return zipFileStep.zipFilePath;
    }

    protected isZipCreatedByDeployment(): boolean {
        const zipFileStep = <ZipFileStep>this.wizard.findStep(step => step instanceof ZipFileStep, 'The Wizard must have a ZipFileStep.');
        
        if (!zipFileStep.zipFilePath) {
            throw new Error('A Zip file must be selected first.');
        }

        return zipFileStep.zipCreatedByStep;
    }
}
