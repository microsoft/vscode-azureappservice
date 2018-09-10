/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, SiteClient } from 'vscode-azureappservice';
import { addExtensionUserAgent, IAzureNode, IAzureTreeItem } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { extensionPrefix } from '../constants';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { FolderTreeItem } from './FolderTreeItem';
import { SiteTreeItem } from './SiteTreeItem';
import { WebJobsTreeItem } from './WebJobsTreeItem';

export class WebAppTreeItem extends SiteTreeItem {
    public static contextValue: string = extensionPrefix;
    public readonly contextValue: string = WebAppTreeItem.contextValue;
    public deploymentSlotsNode: IAzureTreeItem;
    public readonly appSettingsNode: IAzureTreeItem;
    public readonly webJobsNode: IAzureTreeItem;
    public readonly folderNode: IAzureTreeItem;
    public readonly logFolderNode: IAzureTreeItem;
    public connectionsNode: IAzureTreeItem | undefined;

    constructor(client: SiteClient) {
        super(client);
        this.folderNode = new FolderTreeItem(this.client, 'Files', "/site/wwwroot");
        this.logFolderNode = new FolderTreeItem(this.client, 'Log Files', '/LogFiles', 'logFolder');
        this.webJobsNode = new WebJobsTreeItem(this.client);
        this.appSettingsNode = new AppSettingsTreeItem(this.client);

        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        if (workspaceConfig.get(constants.configurationSettings.enableConnectionsNode)) {
            this.connectionsNode = new ConnectionsTreeItem(this.client);
        }
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'WebApp_color.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildren(_parentNode: IAzureNode): Promise<IAzureTreeItem[]> {
        const appServicePlan: AppServicePlan = await this.client.getAppServicePlan();
        // tslint:disable-next-line:no-non-null-assertion
        const tier: string = String(appServicePlan.sku!.tier);
        // tslint:disable-next-line:no-non-null-assertion
        this.deploymentSlotsNode = /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(tier, appServicePlan.id!) : new DeploymentSlotsTreeItem(this.client);
        const nodes = [this.deploymentSlotsNode, this.folderNode, this.logFolderNode, this.webJobsNode, this.appSettingsNode];
        if (this.connectionsNode !== undefined) {
            nodes.push(this.connectionsNode);
        }
        return nodes;
    }

    public pickTreeItem(expectedContextValue: string): IAzureTreeItem | undefined {
        switch (expectedContextValue) {
            case DeploymentSlotsTreeItem.contextValue:
            case DeploymentSlotTreeItem.contextValue:
                return this.deploymentSlotsNode;
            case AppSettingsTreeItem.contextValue:
            case AppSettingTreeItem.contextValue:
                return this.appSettingsNode;
            case FolderTreeItem.contextValue:
                return this.folderNode;
            case WebJobsTreeItem.contextValue:
                return this.webJobsNode;
            default:
                return undefined;
        }
    }

    public openCdInPortal(node: IAzureNode): void {
        node.openInPortal(`${this.client.id}/vstscd`);
    }

    public async generateDeploymentScript(node: IAzureNode): Promise<void> {
        const resourceClient = new ResourceManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
        addExtensionUserAgent(resourceClient);
        const tasks = Promise.all([
            resourceClient.resourceGroups.get(this.client.resourceGroup),
            this.client.getAppServicePlan(),
            this.client.getSiteConfig(),
            this.client.listApplicationSettings()
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
        script = script.replace('%SUBSCRIPTION_NAME%', node.subscriptionDisplayName)
            .replace('%RG_NAME%', rg.name!)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan.name!)
            .replace('%PLAN_SKU%', plan.sku!.name!)
            .replace('%SITE_NAME%', this.client.siteName);
        // tslint:enable:no-non-null-assertion

        const doc = await vscode.workspace.openTextDocument({ language: 'shellscript', content: script });
        await vscode.window.showTextDocument(doc);
    }

    private async loadScriptTemplate(scriptName: string): Promise<string> {
        const templatePath = path.join(__filename, '..', '..', '..', '..', 'resources', 'deploymentScripts', scriptName);
        return await fs.readFile(templatePath, 'utf8');
    }
}
