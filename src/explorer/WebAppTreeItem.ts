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
import { AzExtTreeItem, AzureTreeItem, createAzureClient, IActionContext } from 'vscode-azureextensionui';
import { deploy } from '../commands/deploy/deploy';
import { AppServiceDialogResponses, extensionPrefix } from '../constants';
import { ext } from '../extensionVariables';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
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
        let tier: string | undefined;
        let asp: AppServicePlan | undefined;
        try {
            asp = await this.root.client.getAppServicePlan();
            tier = asp && asp.sku && asp.sku.tier;
        } catch (err) {
            // ignore this error, we don't want to block users for deployment slots
            tier = 'unknown';
        }

        this.deploymentSlotsNode = tier && /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(this, nonNullProp(nonNullValue(asp), 'id')) : new DeploymentSlotsTreeItem(this);
        return (await super.loadMoreChildrenImpl(clearCache)).concat(this.deploymentSlotsNode);
    }

    public async pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined> {
        for (const expectedContextValue of expectedContextValues) {
            switch (expectedContextValue) {
                case DeploymentSlotsTreeItem.contextValue:
                case DeploymentSlotTreeItem.contextValue:
                    return this.deploymentSlotsNode;
                default:
            }
        }

        return super.pickTreeItemImpl(expectedContextValues);
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

    public promptToDeploy(context: IActionContext): void {
        const createdNewAppMsg: string = `Created new web app "${this.root.client.fullName}": https://${this.root.client.defaultHostName}`;

        // Note: intentionally not waiting for the result of this before returning
        vscode.window.showInformationMessage(createdNewAppMsg, AppServiceDialogResponses.deploy, AppServiceDialogResponses.viewOutput).then(async (result: vscode.MessageItem | undefined) => {
            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === AppServiceDialogResponses.deploy) {
                await deploy(context, false, this);
            }
        });
    }

    private async loadScriptTemplate(scriptName: string): Promise<string> {
        const templatePath = path.join(getResourcesPath(), 'deploymentScripts', scriptName);
        return await fs.readFile(templatePath, 'utf8');
    }
}
