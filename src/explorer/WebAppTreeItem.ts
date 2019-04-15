/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem, createAzureClient } from 'vscode-azureextensionui';
import { extensionPrefix } from '../constants';
import { getResourcesPath, getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class WebAppTreeItem extends SiteTreeItem {
    public static contextValue: string = extensionPrefix;
    public readonly contextValue: string = WebAppTreeItem.contextValue;
    public deploymentSlotsNode: DeploymentSlotsTreeItem | DeploymentSlotsNATreeItem;

    public get label(): string {
        return this.root.client.siteName;
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('WebApp_color');
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const asp: AppServicePlan | undefined = await this.root.client.getAppServicePlan();
        const tier: string | undefined = asp && asp.sku && asp.sku.tier;
        // tslint:disable-next-line:no-non-null-assertion
        this.deploymentSlotsNode = tier && /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(this, asp!.id!) : new DeploymentSlotsTreeItem(this);
        return (await super.loadMoreChildrenImpl(clearCache)).concat(this.deploymentSlotsNode);
    }

    public compareChildrenImpl(ti1: AzureTreeItem<ISiteTreeRoot>, ti2: AzureTreeItem<ISiteTreeRoot>): number {
        if (ti1 instanceof DeploymentSlotsNATreeItem) {
            return 1;
        } else if (ti2 instanceof DeploymentSlotsNATreeItem) {
            return -1;
        } else {
            return ti1.label.localeCompare(ti2.label);
        }
    }

    public pickTreeItemImpl(expectedContextValue: string): AzureTreeItem<ISiteTreeRoot> | undefined {
        switch (expectedContextValue) {
            case DeploymentSlotsTreeItem.contextValue:
            case DeploymentSlotTreeItem.contextValue:
                return this.deploymentSlotsNode;
            default:
                return super.pickTreeItemImpl(expectedContextValue);
        }
    }

    public async openCdInPortal(): Promise<void> {
        await this.openInPortal(`${this.root.client.id}/vstscd`);
    }

    public async generateDeploymentScript(): Promise<void> {
        const resourceClient: ResourceManagementClient = createAzureClient(this.root, ResourceManagementClient);
        const tasks = Promise.all([
            resourceClient.resourceGroups.get(this.root.client.resourceGroup),
            this.root.client.getAppServicePlan(),
            this.root.client.getSiteConfig(),
            this.root.client.listApplicationSettings()
        ]);

        const taskResults = await tasks;
        const rg = taskResults[0];
        const plan = taskResults[1];
        const siteConfig = taskResults[2];
        const appSettings = taskResults[3];

        let script: string;

        if (!siteConfig.linuxFxVersion) {
            const scriptTemplate = await this.loadScriptTemplate('windows-default.sh');
            script = scriptTemplate;
        } else if (siteConfig.linuxFxVersion.toLowerCase().startsWith('docker')) {
            const scriptTemplate = await this.loadScriptTemplate('docker-image.sh');
            let serverUrl: string | undefined;
            let serverUser: string | undefined;
            let serverPwd: string | undefined;
            if (appSettings.properties) {
                serverUrl = appSettings.properties.DOCKER_REGISTRY_SERVER_URL;
                serverUser = appSettings.properties.DOCKER_REGISTRY_SERVER_USERNAME;
                serverPwd = appSettings.properties.DOCKER_REGISTRY_SERVER_PASSWORD;
            }
            const containerParameters =
                (serverUrl ? `SERVERURL="${serverUrl}"\n` : '') +
                (serverUser ? `SERVERUSER="${serverUser}"\n` : '') +
                (serverPwd ? `SERVERPASSWORD="*****"\n` : '');
            const containerCmdParameters =
                (serverUrl ? '--docker-registry-server-url $SERVERURL ' : '') +
                (serverUser ? '--docker-registry-server-user $SERVERUSER ' : '') +
                (serverPwd ? '--docker-registry-server-password $SERVERPASSWORD ' : '');
            script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion)
                .replace('%IMAGENAME%', siteConfig.linuxFxVersion.substring(siteConfig.linuxFxVersion.indexOf('|') + 1))
                .replace('%DOCKER_PARA%', containerParameters)
                .replace('%CTN_CMD_PARA%', containerCmdParameters);
        } else {    // Stock linux image
            const scriptTemplate = await this.loadScriptTemplate('linux-default.sh');
            script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion);
        }

        // tslint:disable:no-non-null-assertion
        script = script.replace('%SUBSCRIPTION_NAME%', this.root.subscriptionDisplayName)
            .replace('%RG_NAME%', rg.name!)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan!.name!)
            .replace('%PLAN_SKU%', plan!.sku!.name!)
            .replace('%SITE_NAME%', this.root.client.siteName);
        // tslint:enable:no-non-null-assertion

        const doc = await vscode.workspace.openTextDocument({ language: 'shellscript', content: script });
        await vscode.window.showTextDocument(doc);
    }

    private async loadScriptTemplate(scriptName: string): Promise<string> {
        const templatePath = path.join(getResourcesPath(), 'deploymentScripts', scriptName);
        return await fs.readFile(templatePath, 'utf8');
    }
}
