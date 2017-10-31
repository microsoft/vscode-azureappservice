/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './AzureAccountWrapper';
import { WizardBase, WizardStep, SubscriptionStepBase } from './wizard';
import { WebAppCreator } from './WebAppCreator2';
import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';
import { SiteWrapper } from 'vscode-azureappservice';

export class WebAppZipPublisher extends WizardBase {
    constructor(output: vscode.OutputChannel,
        readonly azureAccount: AzureAccountWrapper,
        readonly subscription?: SubscriptionModels.Subscription,
        readonly site?: WebSiteModels.Site,
        readonly fsPath?: string) {
        super(output);
    }

    protected initSteps() {
        this.steps.push(new ZipFileStep(this, this.fsPath));
        this.steps.push(new SubscriptionStep(this, this.azureAccount, this.subscription));
        this.steps.push(new WebAppStep(this, this.azureAccount, this.site));
        this.steps.push(new DeployStep(this, this.azureAccount));
    }

    protected beforeExecute() { }
}

class ZipFileStep extends WizardStep {
    private _fsPath: string;

    constructor(wizard: WizardBase, fsPath?: string) {
        super(wizard, 'Select or create Zip File');
        this._fsPath = fsPath;
    }

    async prompt(): Promise<void> {
        if (!this._fsPath) {
            const fsWorkspaceFolder = await util.showWorkspaceFoldersQuickPick(`Select the folder to Zip and deploy. (${this.stepProgressText})`);
            this._fsPath = fsWorkspaceFolder.uri.fsPath;
        }
    }

    get fsPath(): string {
        return this._fsPath;
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

        const quickPickItemsTask = this.getSubscriptionsAsQuickPickItems();
        const quickPickOptions = { placeHolder: `Select the subscription where target Web App is. (${this.stepProgressText})` };
        const result = await this.showQuickPick(quickPickItemsTask, quickPickOptions);
        this.subscription = result.data;
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
        const webAppsTask = util.listAll(websiteClient.webApps, websiteClient.webApps.list()).then(webApps => {
            const quickPickItems: util.IQuickPickItemWithData<WebSiteModels.Site>[] = [];
            quickPickItems.push({
                persistenceId: "$new",
                label: '$(plus) Create new Web App',
                description: '',
                data: null
            });
            webApps.forEach(element => {
                if (element.kind.toLowerCase().indexOf('app') >= 0 &&
                    element.kind.toLowerCase().indexOf('linux') >= 0) {
                    quickPickItems.push({
                        persistenceId: element.id,
                        label: element.name,
                        description: `(${element.resourceGroup})`,
                        data: element
                    });
                }
            });

            return quickPickItems;
        });

        const pickedItem = await this.showQuickPick(webAppsTask, { placeHolder: 'Select the target Web App' });

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
        const subscriptionStep = this.wizard.findStepOfType(SubscriptionStep);

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
        const subscription = this.getSelectedSubscription();
        const fsPath = this.getFsPath();
        const siteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);

        const siteWrapper: SiteWrapper = new SiteWrapper(this.getSelectedWebApp());
        await siteWrapper.deployZip(fsPath, siteClient, this.wizard.output);
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = this.wizard.findStepOfType(SubscriptionStep);

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }

    protected getSelectedWebApp(): WebSiteModels.Site {
        const webAppStep = this.wizard.findStepOfType(WebAppStep);

        if (!webAppStep.site) {
            throw new Error('A Web App must be selected first.');
        }

        return webAppStep.site;
    }

    protected getFsPath(): string {
        const zipFileStep = this.wizard.findStepOfType(ZipFileStep);

        if (!zipFileStep.fsPath) {
            throw new Error('A Zip File must be selected first.');
        }

        return zipFileStep.fsPath;
    }
}
