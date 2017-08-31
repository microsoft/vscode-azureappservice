/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, UserCancelledError } from './wizard';
import { KuduClient } from './kuduClient';
import { SubscriptionModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export class WebAppZipPublisher extends WizardBase {
    constructor(output: vscode.OutputChannel, 
        readonly azureAccount: AzureAccountWrapper, 
        readonly subscription?: SubscriptionModels.Subscription,
        readonly site?: WebSiteModels.Site,
        readonly zipFilePath?: string) {
        super(output);
        this.steps.push(new SubscriptionStep(this, azureAccount, subscription));
        this.steps.push(new WebAppStep(this, azureAccount, site));
        this.steps.push(new ZipFileStep(this, zipFilePath));
        this.steps.push(new DeployStep(this, azureAccount));
    }
}

class SubscriptionStep extends WizardStep {
    constructor(wizard: WizardBase,
        readonly azureAccount: AzureAccountWrapper,
        readonly subscription?: SubscriptionModels.Subscription) {
        super(wizard, 'Select target Subscription');
    }
}

class WebAppStep extends WizardStep {
    constructor(wizard: WizardBase,
        readonly azureAccount: AzureAccountWrapper,
        readonly site?: WebSiteModels.Site) {
        super(wizard, 'Select or create Web App');
    }
}

class ZipFileStep extends WizardStep {
    constructor(wizard: WizardBase,
        readonly zipFilePath?: string) {
        super(wizard, 'Select or create Zip File');
    }
}

class DeployStep extends WizardStep {
    constructor(wizard: WizardBase, readonly azureAccount: AzureAccountWrapper) {
        super(wizard, 'Deploy to Web App');
    }

    async execute(): Promise<void> {
        const subscription = this.getSelectedSubscription();
        const site = this.getSelectedWebApp();
        const zipFilePath = this.getSelectedZipFilePath();
        const user = await util.getWebAppPublishCredential(this.azureAccount, subscription, site);
        const kuduClient = new KuduClient(site.name, user.publishingUserName, user.publishingPassword);
        
        this.wizard.writeline('Deleting existing deployment...');
        await kuduClient.vfsDeleteFile('site/wwwroot/hostingstart.html');
        
        this.wizard.writeline('Uploading Zip package...');
        await kuduClient.zipUpload(zipFilePath, 'site/wwwroot');

        this.wizard.writeline('Restarting web app...');
        const siteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        await siteClient.webApps.restart(site.resourceGroup, site.name);

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
}