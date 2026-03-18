/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Site, type WebSiteManagementClient } from '@azure/arm-appservice';
import { DeploymentSlotConfigSourceStep, DeploymentSlotCreateStep, DeploymentSlotNameStep, ParsedSite, type IAppServiceWizardContext, type ICreateSlotContext } from '@microsoft/vscode-azext-azureappservice';
import { uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, nonNullProp, type ExecuteActivityContext, type IActionContext, type ICreateChildImplContext, type TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { getCreatedSlotMessage } from '../commands/createWebApp/showCreatedSlotMessage';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { createActivityContext } from '../utils/activityUtils';
import { createWebSiteClient } from '../utils/azureClients';
import { getThemedIconPath } from '../utils/pathUtils';
import { NotAvailableTreeItem } from './NotAvailableTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

const label: string = localize('deploymentSlots', 'Deployment Slots');
export class DeploymentSlotsTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = label;
    public readonly childTypeLabel: string = 'Deployment Slot';
    public suppressMaskLabel = true;
    public parent: SiteTreeItem;

    private _nextLink: string | undefined;

    constructor(parent: SiteTreeItem) {
        super(parent);
        this.parent = parent;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlots_color');
    }

    public get id(): string {
        return `${this.parent.site.id}/slots`;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._nextLink;
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = await createWebSiteClient([context, this]);
        // Load more currently broken https://github.com/Azure/azure-sdk-for-js/issues/20380
        const webAppCollection: Site[] = await uiUtils.listAllIterator(client.webApps.listSlots(this.parent.site.resourceGroup, this.parent.site.siteName));

        return webAppCollection.map(s => new SiteTreeItem(this, s));
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IAppServiceWizardContext>): Promise<AzExtTreeItem> {
        const existingSlots = (<SiteTreeItem[]>await this.getCachedChildren(context)).map(ti => ti.site);
        const wizardContext: ICreateSlotContext & ExecuteActivityContext = Object.assign(context, {
            activityTitle: localize('createDeploymentSlot', 'Create deployment slot'),
            ...(await createActivityContext({ withChildren: false })),
            parentSite: this.parent.site,
            existingSlots,
        });

        const wizard = new AzureWizard<ICreateSlotContext & ExecuteActivityContext>(wizardContext, {
            promptSteps: [new DeploymentSlotNameStep(), new DeploymentSlotConfigSourceStep()],
            executeSteps: [new DeploymentSlotCreateStep()]
        });

        await wizard.prompt();
        // Update the activity title now that we have the slot name
        wizardContext.activityTitle = localize('createdDeploymentSlot', 'Create slot "{0}"', wizardContext.newDeploymentSlotName);
        await wizard.execute();

        const newSite = new ParsedSite(nonNullProp(wizardContext, 'site'), this.parent.subscription);
        ext.outputChannel.appendLog(getCreatedSlotMessage(newSite));
        return new SiteTreeItem(this, nonNullProp(wizardContext, 'site'));
    }
}

export class ScaleUpTreeItem extends AzExtTreeItem {
    public static contextValue: string = "ScaleUp";
    public readonly label: string = localize('scaleUp', "Scale up to a production plan to enable slots...");
    public readonly contextValue: string = ScaleUpTreeItem.contextValue;
    public readonly scaleUpId: string;

    public constructor(parent: AzExtParentTreeItem, scaleUpId: string) {
        super(parent);
        this.scaleUpId = scaleUpId;
        this.commandId = 'appService.ScaleUp';
    }
}

export class DeploymentSlotsNATreeItem extends NotAvailableTreeItem {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string;
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly childTypeLabel: string = localize('scaleUpToEnable', 'scale up to enable slots');
    public suppressMaskLabel = true;

    public readonly scaleUpId: string;

    public constructor(parent: AzExtParentTreeItem, planId: string) {
        super(parent);
        this.label = label;
        this.id = DeploymentSlotsNATreeItem.contextValue;
        this.scaleUpId = `${planId}/pricingTier`;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('DeploymentSlots_grayscale');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

     
    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        return [new ScaleUpTreeItem(this, this.scaleUpId)];
    }
}
