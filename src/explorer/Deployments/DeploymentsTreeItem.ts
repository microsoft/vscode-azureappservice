/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { getKuduClient, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import * as constants from '../../constants';
import { SiteTreeItem } from '../SiteTreeItem';
import { DeploymentTreeItem } from './DeploymentTreeItem';

export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployments';
    public readonly contextValue: string = DeploymentsTreeItem.contextValue;
    public readonly label: string = 'Deployments';
    public readonly childTypeLabel: string = 'Deployment';
    public parent: SiteTreeItem;

    private _nextLink: string | undefined;

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'WebJobs_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'WebJobs_color.svg')
        };
    }

    public get id(): string {
        return `${this.root.client.id}/vstscd`;
    }

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<DeploymentTreeItem[] | ConnectToGitHubTreeItem[]> {
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
        return ti2.lastSuccessEndTime.valueOf() - ti1.lastSuccessEndTime.valueOf();
    }
}

export class ConnectToGitHubTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public readonly label: string = "Connect to a Git repository...";
    public readonly contextValue: string = "ConnectToGithub";
    public readonly commandId: string = 'appService.ConfigureDeploymentSource';
    public parent: DeploymentsTreeItem;

    public constructor(parent: DeploymentsTreeItem) {
        super(parent);
    }
}
