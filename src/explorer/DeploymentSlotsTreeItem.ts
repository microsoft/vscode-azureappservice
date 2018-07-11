/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient = require('azure-arm-website');
import { NameValuePair, ResourceNameAvailability, Site, WebAppCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { SiteClient } from 'vscode-azureappservice';
import { addExtensionUserAgent, IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureQuickPickItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotsTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'deploymentSlots';
    public readonly contextValue: string = DeploymentSlotsTreeItem.contextValue;
    public readonly label: string = 'Deployment Slots';
    public readonly childTypeLabel: string = 'Deployment Slot';
    public readonly client: SiteClient;

    private _nextLink: string | undefined;

    constructor(client: SiteClient) {
        this.client = client;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_color.svg')
        };
    }

    public get id(): string {
        return `${this.client.id}/slots`;
    }

    public hasMoreChildren(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildren(node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const client: WebSiteManagementClient = new WebSiteManagementClient(node.credentials, node.subscriptionId);
        addExtensionUserAgent(client);
        const webAppCollection: WebAppCollection = this._nextLink === undefined ?
            await client.webApps.listSlots(this.client.resourceGroup, this.client.siteName) :
            await client.webApps.listSlotsNext(this._nextLink);

        this._nextLink = webAppCollection.nextLink;

        return webAppCollection.map((s: Site) => new DeploymentSlotTreeItem(new SiteClient(s, node)));
    }

    public async createChild(node: IAzureParentNode<DeploymentSlotsTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const client: WebSiteManagementClient = new WebSiteManagementClient(node.credentials, node.subscriptionId);
        addExtensionUserAgent(client);
        let slotName: string = await this.promptForSlotName(client);
        if (!slotName) {
            throw new UserCancelledError();
        }

        slotName = slotName.trim();
        const newDeploymentSlot: Site = {
            name: slotName,
            kind: this.client.kind,
            location: this.client.location,
            serverFarmId: this.client.serverFarmId,
            siteConfig: {
                appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
            }
        };

        const configurationSource: SiteClient | undefined = await this.chooseConfigurationSource(node);
        if (!!configurationSource) {
            const appSettings = await this.parseAppSettings(configurationSource);
            // tslint:disable-next-line:no-non-null-assertion
            newDeploymentSlot.siteConfig!.appSettings = appSettings;
        }

        showCreatingNode(slotName);

        // if user has more slots than the service plan allows, Azure will respond with an error
        const newSite: Site = await client.webApps.createOrUpdateSlot(this.client.resourceGroup, this.client.siteName, newDeploymentSlot, slotName);
        return new DeploymentSlotTreeItem(new SiteClient(newSite, node));
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

                const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(`${this.client.siteName}-${value}`, 'Slot');
                if (!nameAvailability.nameAvailable) {
                    return nameAvailability.message;
                }

                return null;
            }
        });
    }

    private async chooseConfigurationSource(node: IAzureParentNode<DeploymentSlotsTreeItem>): Promise<SiteClient | undefined> {
        const deploymentSlots: IAzureNode[] = await node.getCachedChildren();
        const configurationSources: IAzureQuickPickItem<SiteClient | undefined>[] = [{
            label: "Don't clone configuration from an existing slot",
            description: '',
            data: undefined
        }];

        // tslint:disable-next-line:no-non-null-assertion
        const prodSiteClient: SiteClient = (<SiteTreeItem>node.parent!.treeItem).client;
        // add the production slot itself
        configurationSources.push({
            // tslint:disable-next-line:no-non-null-assertion
            label: prodSiteClient.fullName,
            description: '',
            data: prodSiteClient
        });

        // add the web app's current deployment slots
        for (const slot of deploymentSlots) {
            const slotSiteClient: SiteClient = (<SiteTreeItem>slot.treeItem).client;
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

export class DeploymentSlotsNATreeItem implements IAzureParentTreeItem {
    public static contextValue: string = "deploymentNASlots";
    public readonly label: string;
    public readonly contextValue: string = DeploymentSlotsNATreeItem.contextValue;
    public readonly id: string = DeploymentSlotsNATreeItem.contextValue;

    public readonly scaleUpId: string;

    public constructor(tier: string, planId: string) {
        this.label = `Deployment Slots (N/A for ${tier} Service Plan)`;
        this.scaleUpId = `${planId}/pricingTier`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_grayscale.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_grayscale.svg')
        };
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(_node: IAzureNode): Promise<IAzureTreeItem[]> {
        return [new ScaleUpTreeItem(this.scaleUpId)];
    }
}

export class ScaleUpTreeItem implements IAzureTreeItem {
    public readonly label: string = "Scale Up App Service Plan...";
    public readonly contextValue: string = "ScaleUp";
    public readonly commandId: string = 'appService.ScaleUp';

    public readonly scaleUpId: string;

    public constructor(scaleUpId: string) {
        this.scaleUpId = scaleUpId;
    }
}
