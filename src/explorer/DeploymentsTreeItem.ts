/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deployment, DeploymentCollection } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { TreeItem } from 'vscode';
import { ISiteTreeRoot, SiteClient } from 'vscode-azureappservice';
import { AzureParentTreeItem } from 'vscode-azureextensionui';
import { parseAzureResourceId } from '../util';
import { DeploymentTreeItem } from './DeploymentTreeItem';

export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployments';
    public readonly contextValue: string = DeploymentsTreeItem.contextValue;
    public readonly label: string = 'Deployments';
    public readonly childTypeLabel: string = 'Deployment';

    private _nextLink: string | undefined;

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'WebJobs_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'WebJobs_color.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return this._nextLink !== undefined;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<DeploymentTreeItem[]> {
        const deployments: DeploymentCollection = await this.root.client.listDeployments();
        return deployments.map((deployment: Deployment) => {
            const parsedAzureResourceId: string = parseAzureResourceId(deployment.id);
            const id: string = parsedAzureResourceId.deployments;
            return new DeploymentTreeItem(this, id, deployment.active);
        });

    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<void> {
        // may not need this
    }
