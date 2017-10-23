/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: Will rename this file to WebAppCreator after this PR, to make changes easier to understand

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './AzureAccountWrapper';
import { AppServicePlanStep, AppKind, ResourceGroupStep, SubscriptionStep, WebsiteCreatorBase, WebsiteOS, WebsiteNameStep, WebsiteStep } from "./WebAppCreator";
import { SubscriptionModels } from 'azure-arm-resource';
import { WizardStep } from "./wizard";

export class WebAppCreator extends WebsiteCreatorBase {
    constructor(output: vscode.OutputChannel, readonly azureAccount: AzureAccountWrapper, subscription: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(output, azureAccount, subscription, persistence);
    }

    protected appKind: AppKind = "app";
    protected websiteOS: WebsiteOS = "linux";

    protected initSteps(): void {
        this.steps.push(new SubscriptionStep(this, this.azureAccount,
            {
                prompt: "Select the subscription to create the new Web App in."
            },
            this.subscription, this.persistence));
        this.steps.push(new WebsiteNameStep(this, this.azureAccount, this.appKind, this.persistence));
        this.steps.push(new ResourceGroupStep(this, this.azureAccount, this.persistence));
        this.steps.push(new AppServicePlanStep(this, this.azureAccount, this.appKind, this.websiteOS, this.persistence));
        this.steps.push(new WebsiteStep(this, this.azureAccount, this.appKind, this.websiteOS, this.persistence));
    }

    protected beforeExecute(_step: WizardStep, stepIndex: number) {
        if (stepIndex == 0) {
            this.writeline('Creating new Web App...');
        }
    }
}
