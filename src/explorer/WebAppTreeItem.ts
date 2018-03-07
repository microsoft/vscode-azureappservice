/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, Site } from 'azure-arm-website/lib/models';
import * as fs from 'fs-extra';
import * as opn from 'opn';
import * as path from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem } from 'vscode-azureappservice';
import { IAzureNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { nodeUtils } from '../utils/nodeUtils';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { FolderTreeItem } from './FolderTreeItem';
import { getAppServicePlan, SiteTreeItem } from './SiteTreeItem';
import { WebJobsTreeItem } from './WebJobsTreeItem';

export class WebAppTreeItem extends SiteTreeItem {
    public static contextValue: string = extensionPrefix;
    public readonly contextValue: string = WebAppTreeItem.contextValue;
    public readonly deploymentSlotsNode: IAzureTreeItem;
    public readonly appSettingsNode: IAzureTreeItem;
    public readonly webJobsNode: IAzureTreeItem;
    public readonly folderNode: IAzureTreeItem;

    constructor(site: Site, appServicePlan: AppServicePlan) {
        super(site);
        this.deploymentSlotsNode = appServicePlan.sku.tier === 'Basic' ? new DeploymentSlotsNATreeItem() : new DeploymentSlotsTreeItem(site);
        this.folderNode = new FolderTreeItem(this.siteWrapper, 'Files', "/site/wwwroot", true);
        this.webJobsNode = new WebJobsTreeItem(site);
        this.appSettingsNode = new AppSettingsTreeItem(this.siteWrapper);
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'WebApp_color.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildren(_parentNode: IAzureNode): Promise<IAzureTreeItem[]> {
        return vscode.workspace.getConfiguration(extensionPrefix).get(configurationSettings.showRemoteFiles) ?
            [this.deploymentSlotsNode, this.folderNode, this.webJobsNode, this.appSettingsNode] :
            [this.deploymentSlotsNode, this.webJobsNode, this.appSettingsNode];
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
        const deepLink = `${node.environment.portalUrl}/${node.tenantId}/#resource${this.site.id}/vstscd`;
        // tslint:disable-next-line:no-unsafe-any
        opn(deepLink);
    }

    public async generateDeploymentScript(node: IAzureNode): Promise<void> {
        const resourceClient = new ResourceManagementClient(node.credentials, node.subscription.subscriptionId);
        const webSiteClient: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        const subscription = node.subscription;
        const site = this.site;
        const tasks = Promise.all([
            resourceClient.resourceGroups.get(this.site.resourceGroup),
            getAppServicePlan(this.site, webSiteClient),
            webSiteClient.webApps.getConfiguration(this.site.resourceGroup, this.site.name),
            webSiteClient.webApps.listApplicationSettings(this.site.resourceGroup, this.site.name)
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
            const serverUrl = appSettings.properties.DOCKER_REGISTRY_SERVER_URL;
            const serverUser = appSettings.properties.DOCKER_REGISTRY_SERVER_USERNAME;
            const serverPwd = appSettings.properties.DOCKER_REGISTRY_SERVER_PASSWORD;
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

        script = script.replace('%SUBSCRIPTION_NAME%', subscription.displayName)
            .replace('%RG_NAME%', rg.name)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan.name)
            .replace('%PLAN_SKU%', plan.sku.name)
            .replace('%SITE_NAME%', site.name);

        const doc = await vscode.workspace.openTextDocument({ language: 'shellscript', content: script });
        await vscode.window.showTextDocument(doc);
    }

    private async loadScriptTemplate(scriptName: string): Promise<string> {
        const templatePath = path.join(__filename, '..', '..', '..', '..', 'resources', 'deploymentScripts', scriptName);
        return await fs.readFile(templatePath, 'utf8');
    }
}
