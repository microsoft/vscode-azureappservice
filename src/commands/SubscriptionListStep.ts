/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, type IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { type AzureSubscription } from "@microsoft/vscode-azureresources-api";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { type IWebAppDeployContext } from "./deploy/getOrCreateWebApp";

export class SubscriptionListStep extends AzureWizardPromptStep<IWebAppDeployContext> {
    private _picks: IAzureQuickPickItem<AzureSubscription>[] = [];
    private _oneSubscription: boolean = false;
    constructor(readonly findBySubId?: string) {
        super();
    }
    public async prompt(context: IWebAppDeployContext): Promise<void> {
        context.subscription = (await context.ui.showQuickPick(this._picks, { placeHolder: localize('selectSubscription', 'Select a subscription') })).data;
        context.telemetry.properties.subscriptionId = context.subscription.subscriptionId;
    }

    public shouldPrompt(context: IWebAppDeployContext): boolean {
        return !this._oneSubscription && !context.subscription;
    }

    public async configureBeforePrompt(context: IWebAppDeployContext): Promise<void> {
        this._picks = await this.getPicks();
        // auto select if only one subscription
        if (this._picks.length === 1) {
            this._oneSubscription = true;
            context.subscription = this._picks[0].data;
            context.telemetry.properties.subscriptionId = context.subscription.subscriptionId;
        } else if (this.findBySubId && this._picks.length > 0) {
            context.subscription = this._picks.find(s => s.data.subscriptionId === this.findBySubId)?.data;
        }
    }

    private async getPicks(): Promise<IAzureQuickPickItem<AzureSubscription>[]> {
        return (await ext.rgApi.getSubscriptions(true)).map(s => {
            return { label: s.name, description: s.subscriptionId, data: s };
        });
    }
}
