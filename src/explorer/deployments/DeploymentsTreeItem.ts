/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { editScmType, getKuduClient, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, DialogResponses } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { SiteTreeItem } from '../SiteTreeItem';
import { ConnectToGitHubTreeItem, DeploymentTreeItem } from './DeploymentTreeItem';

export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public contextValue: string = DeploymentsTreeItem.contextValueUnconnected;
    public readonly label: string = 'Deployments';
    public readonly childTypeLabel: string = 'Deployment';
    public parent: SiteTreeItem;

    public constructor(parent: SiteTreeItem, siteConfig: SiteConfig) {
        super(parent);
        this.contextValue = siteConfig.scmType === constants.ScmType.None ? DeploymentsTreeItem.contextValueUnconnected : DeploymentsTreeItem.contextValueConnected;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'Deployments_x16.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'Deployments_x16.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<DeploymentTreeItem[] | ConnectToGitHubTreeItem[]> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        if (siteConfig.scmType === constants.ScmType.GitHub || siteConfig.scmType === constants.ScmType.LocalGit) {
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            const deployments: DeployResult[] = await kuduClient.deployment.getDeployResults();
            return deployments.map((deployResult: DeployResult) => {
                return new DeploymentTreeItem(this, deployResult, kuduClient);
            });
        } else {
            return [new ConnectToGitHubTreeItem(this)];
        }
    }

    public compareChildrenImpl(ti1: DeploymentTreeItem, ti2: DeploymentTreeItem): number {
        // sorts in accordance of the most recent deployment
        return ti2.receivedTime.valueOf() - ti1.receivedTime.valueOf();
    }

    public async disconnectRepo(): Promise<void> {
        const disconnect: string = 'Disconnect from current repository?  You can reconnect at anytime.';
        await ext.ui.showWarningMessage(disconnect, DialogResponses.yes, DialogResponses.cancel);
        await editScmType(this.parent.root.client, this.parent.root, constants.ScmType.None);
        await this.refresh();
    }

    public async refreshLabelImpl(): Promise<void> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        if (siteConfig.scmType === constants.ScmType.GitHub || siteConfig.scmType === constants.ScmType.LocalGit) {
            this.contextValue = DeploymentsTreeItem.contextValueConnected;
        } else {
            this.contextValue = DeploymentsTreeItem.contextValueUnconnected;
        }
    }
}
