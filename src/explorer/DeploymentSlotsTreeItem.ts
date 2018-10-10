/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { NameValuePair, ResourceNameAvailability, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, createAzureClient, IAzureQuickPickItem, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';

export class DeploymentSlotsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = 'Deployment Slots';
    public readonly childTypeLabel: string = 'Deployment Slot';

    private _nextLink: string | undefined;

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_color.svg')
        };
    }

    public get id(): string {
        return `${this.root.client.id}/slots`;
    }

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await client.webApps.listSlots(this.root.client.resourceGroup, this.root.client.siteName) :
            await client.webApps.listSlotsNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return webAppCollection.map((s: Site) => new DeploymentSlotTreeItem(this, new SiteClient(s, this.root)));
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const client: WebSiteManagementClient = createAzureClient(this.root, WebSiteManagementClient);
        let slotName: string = await this.promptForSlotName(client);
        if (!slotName) {
            throw new UserCancelledError();
        }

        slotName = slotName.trim();
        const newDeploymentSlot: Site = {
            name: slotName,
            kind: this.root.client.kind,
            location: this.root.client.location,
            serverFarmId: this.root.client.serverFarmId,
            siteConfig: {
                appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
            }
        };

        const configurationSource: SiteClient | undefined = await this.chooseConfigurationSource();
        if (!!configurationSource) {
            const appSettings = await this.parseAppSettings(configurationSource);
            // tslint:disable-next-line:no-non-null-assertion
            newDeploymentSlot.siteConfig!.appSettings = appSettings;
        }

        showCreatingTreeItem(slotName);

        // if user has more slots than the service plan allows, Azure will respond with an error
        const newSite: Site = await client.webApps.createOrUpdateSlot(this.root.client.resourceGroup, this.root.client.siteName, newDeploymentSlot, slotName);
        return new DeploymentSlotTreeItem(this, new SiteClient(newSite, this.root));
    }

    private async promptForSlotName(client: WebSiteManagementClient): Promise<string> {
        return await ext.ui.showInputBox({
            prompt: 'Enter a unique name for the new deployment slot',
            ignoreFocusOut: true,
            validateInput: async (value: string) => {
                value = value ? value.trim() : '';
                // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
                if (value === 'production') {
                    return `The slot name "${value}" is not available.`;
                }

                const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(`${this.root.client.siteName}-${value}`, 'Slot');
                if (!nameAvailability.nameAvailable) {
                    return nameAvailability.message;
                }

                return null;
            }
        });
    }

    private async chooseConfigurationSource(): Promise<SiteClient | undefined> {
        const deploymentSlots: DeploymentSlotTreeItem[] = <DeploymentSlotTreeItem[]>await this.getCachedChildren();
        const configurationSources: IAzureQuickPickItem<SiteClient | undefined>[] = [{
            label: "Don't clone configuration from an existing slot",
            description: '',
            data: undefined
        }];

        const prodSiteClient: SiteClient = this.root.client;
        // add the production slot itself
        configurationSources.push({
            // tslint:disable-next-line:no-non-null-assertion
            label: prodSiteClient.fullName,
            description: '',
            data: prodSiteClient
        });

        // add the web app's current deployment slots
        for (const slot of deploymentSlots) {
            const slotSiteClient: SiteClient = slot.root.client;
            configurationSources.push({
                label: slotSiteClient.fullName,
                description: '',
                data: slotSiteClient
            });
        }

        const quickPickOptions = { placeHolder: `Choose a configuration source.`, ignoreFocusOut: true };
        return (await ext.ui.showQuickPick(configurationSources, quickPickOptions)).data;
    }

    private async parseAppSettings(siteClient: SiteClient): Promise<NameValuePair[]> {
        const appSettings = await siteClient.listApplicationSettings();
        const appSettingPairs: NameValuePair[] = [];
        if (appSettings.properties) {
            // iterate String Dictionary to parse into NameValuePair[]
            for (const key of Object.keys(appSettings.properties)) {
                appSettingPairs.push({ name: key, value: appSettings.properties[key] });
            }
        }
        return appSettingPairs;
    }

}

export class ScaleUpTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public readonly label: string = "Scale up App Service Plan...";
    public readonly contextValue: string = "ScaleUp";
    public readonly commandId: string = 'appService.ScaleUp';

    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, scaleUpId: string) {
        super(parent);
        this.scaleUpId = scaleUpId;
    }
}

export class DeploymentSlotsNATreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string;
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly id: string = DeploymentSlotsNATreeItem.contextValue;

    public readonly scaleUpId: string;

    public constructor(parent: AzureParentTreeItem, tier: string, planId: string) {
        super(parent);
        this.label = `Deployment Slots (N/A for ${tier} Service Plan)`;
        this.scaleUpId = `${planId}/pricingTier`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_grayscale.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_grayscale.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        return [new ScaleUpTreeItem(this, this.scaleUpId)];
    }
}
