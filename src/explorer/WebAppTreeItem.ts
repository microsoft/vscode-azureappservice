/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { AppSettingsTreeItem, AppSettingTreeItem, ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem, createAzureClient } from 'vscode-azureextensionui';
import * as constants from '../constants';
import { extensionPrefix } from '../constants';
import { ConnectionsTreeItem } from './ConnectionsTreeItem';
import { DeploymentSlotsNATreeItem, DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { DeploymentSlotTreeItem } from './DeploymentSlotTreeItem';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';
import { FolderTreeItem } from './FolderTreeItem';
import { SiteTreeItem } from './SiteTreeItem';
import { WebJobsTreeItem } from './WebJobsTreeItem';

export class WebAppTreeItem extends SiteTreeItem {
    public static contextValue: string = extensionPrefix;
    public readonly contextValue: string = WebAppTreeItem.contextValue;
    public deploymentSlotsNode: DeploymentSlotsTreeItem | DeploymentSlotsNATreeItem;
    public readonly appSettingsNode: AppSettingsTreeItem;
    public readonly webJobsNode: WebJobsTreeItem;
    public readonly folderNode: FolderTreeItem;
    public readonly logFolderNode: FolderTreeItem;
    public readonly connectionsNode: ConnectionsTreeItem;
    public readonly deploymentsNode: DeploymentsTreeItem;

    constructor(parent: AzureParentTreeItem, client: SiteClient) {
        super(parent, client);
        this.folderNode = new FolderTreeItem(this, 'Files', "/site/wwwroot");
        this.logFolderNode = new FolderTreeItem(this, 'Log Files', '/LogFiles', 'logFolder');
        this.webJobsNode = new WebJobsTreeItem(this);
        this.appSettingsNode = new AppSettingsTreeItem(this);
        this.connectionsNode = new ConnectionsTreeItem(this);
        this.deploymentsNode = new DeploymentsTreeItem(this);
    }

    public get iconPath(): { light: string, dark: string } {
        const iconName = 'WebApp_color.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        const asp: AppServicePlan | undefined = await this.root.client.getAppServicePlan();
        const tier: string | undefined = asp && asp.sku && asp.sku.tier;
        // tslint:disable-next-line:no-non-null-assertion
        this.deploymentSlotsNode = tier && /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsNATreeItem(this, tier, asp!.id!) : new DeploymentSlotsTreeItem(this);
        const nodes: AzureTreeItem<ISiteTreeRoot>[] = [this.deploymentSlotsNode, this.folderNode, this.logFolderNode, this.webJobsNode, this.appSettingsNode, this.deploymentsNode];
        const workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix);
        if (workspaceConfig.get(constants.configurationSettings.enableConnectionsNode)) {
            nodes.push(this.connectionsNode);
        }
        return nodes;
    }

    public pickTreeItemImpl(expectedContextValue: string): AzureTreeItem<ISiteTreeRoot> | undefined {
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
            case DeploymentsTreeItem.contextValue:
                return this.deploymentsNode;
            default:
                return undefined;
        }
    }

    public openCdInPortal(): void {
        this.openInPortal(`${this.root.client.id}/vstscd`);
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
        const templatePath = path.join(__filename, '..', '..', '..', '..', 'resources', 'deploymentScripts', scriptName);
        return await fs.readFile(templatePath, 'utf8');
    }
}
