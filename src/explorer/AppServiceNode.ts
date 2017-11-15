/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient, SubscriptionModels } from 'azure-arm-resource';
import * as fs from 'fs';
import * as opn from 'opn';
import * as path from 'path';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as vscode from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { UserCancelledError } from '../errors';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { AppSettingsNode } from './AppSettingsNodes';
import { DeploymentSlotsNANode, DeploymentSlotsNode } from './DeploymentSlotsNode';
import { NodeBase } from './NodeBase';
import { SiteNodeBase } from './SiteNodeBase';
import { WebJobsNode } from './WebJobsNode';

export class AppServiceNode extends SiteNodeBase {
    constructor(site: WebSiteModels.Site, subscription: SubscriptionModels.Subscription, treeDataProvider: AppServiceDataProvider, parentNode: NodeBase) {
        super(site.name, site, subscription, treeDataProvider, parentNode);
    }

    public getTreeItem(): TreeItem {
        const iconName = 'WebApp_color.svg';
        return {
            label: `${this.label} (${this.site.resourceGroup})`,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'appService',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
            }
        };
    }

    public async getChildren(): Promise<NodeBase[]> {
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return [];
        }

        const treeDataProvider = this.getTreeDataProvider<AppServiceDataProvider>();
        const nodes = [];
        const appServicePlan = await this.getAppServicePlan();
        appServicePlan.sku.tier === 'Basic' ?
            nodes.push(new DeploymentSlotsNANode(treeDataProvider, this)) :
            nodes.push(new DeploymentSlotsNode(this.site, this.subscription, treeDataProvider, this));
        // https://github.com/Microsoft/vscode-azureappservice/issues/45
        // nodes.push(new FilesNode('Files', '/site/wwwroot', this.site, this.subscription, treeDataProvider, this));
        // nodes.push(new FilesNode('Log Files', '/LogFiles', this.site, this.subscription));
        nodes.push(new WebJobsNode(this.site, this.subscription, treeDataProvider, this));
        nodes.push(new AppSettingsNode(this.site, this.subscription, treeDataProvider, this));

        return nodes;
    }

    public openCdInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}/vstscd`;
        opn(deepLink);
    }

    public async generateDeploymentScript(): Promise<void> {
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(this.subscription.tenantId), this.subscription.subscriptionId);
        const subscription = this.subscription;
        const site = this.site;
        const tasks = Promise.all([
            resourceClient.resourceGroups.get(this.site.resourceGroup),
            this.getAppServicePlan(),
            this.webSiteClient.webApps.getConfiguration(this.site.resourceGroup, this.site.name)
        ]);

        let uri: vscode.Uri;
        uri = await vscode.window.showSaveDialog({ filters: { 'Shell Script (Bash)': ['sh'] } });

        if (!uri) {
            throw new UserCancelledError();
        }

        const taskResults = await tasks;
        const rg = taskResults[0];
        const plan = taskResults[1];
        const siteConfig = taskResults[2];
        const script = scriptTemplate.replace('%SUBSCRIPTION_NAME%', subscription.displayName)
            .replace('%RG_NAME%', rg.name)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan.name)
            .replace('%PLAN_SKU%', plan.sku.name)
            .replace('%SITE_NAME%', site.name)
            .replace('%RUNTIME%', siteConfig.linuxFxVersion);
        await new Promise<void>((resolve, reject) => {
            fs.writeFile(uri.fsPath, script, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
    }
}

const scriptTemplate = 'SUBSCRIPTION="%SUBSCRIPTION_NAME%"\n\
RESOURCEGROUP="%RG_NAME%"\n\
LOCATION="%LOCATION%"\n\
PLANNAME="%PLAN_NAME%"\n\
PLANSKU="%PLAN_SKU%"\n\
SITENAME="%SITE_NAME%"\n\
RUNTIME="%RUNTIME%"\n\
\n\
# login supports device login, username/password, and service principals\n\
# see https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest#az_login\n\
az login\n\
# list all of the available subscriptions\n\
az account list -o table\n\
# set the default subscription for subsequent operations\n\
az account set --subscription $SUBSCRIPTION\n\
# create a resource group for your application\n\
az group create --name $RESOURCEGROUP --location $LOCATION\n\
# create an appservice plan (a machine) where your site will run\n\
az appservice plan create --name $PLANNAME --location $LOCATION --is-linux --sku $PLANSKU --resource-group $RESOURCEGROUP\n\
# create the web application on the plan\n\
# specify the node version your app requires\n\
az webapp create --name $SITENAME --plan $PLANNAME --runtime $RUNTIME --resource-group $RESOURCEGROUP\n\
\n\
# To set up deployment from a local git repository, uncomment the following commands.\n\
# first, set the username and password (use environment variables!)\n\
# USERNAME=""\n\
# PASSWORD=""\n\
# az webapp deployment user set --user-name $USERNAME --password $PASSWORD\n\
\n\
# now, configure the site for deployment. in this case, we will deploy from the local git repository\n\
# you can also configure your site to be deployed from a remote git repository or set up a CI/CD workflow\n\
# az webapp deployment source config-local-git --name $SITENAME --resource-group $RESOURCEGROUP\n\
\n\
# the previous command returned the git remote to deploy to\n\
# use this to set up a new remote named "azure"\n\
# git remote add azure "https://$USERNAME@$SITENAME.scm.azurewebsites.net/$SITENAME.git"\n\
# push master to deploy the site\n\
# git push azure master\n\
\n\
# browse to the site\n\
# az webapp browse --name $SITENAME --resource-group $RESOURCEGROUP\n\
';
