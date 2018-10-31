/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deployment } from 'azure-arm-website/lib/models';
import { TreeItem } from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem } from 'vscode-azureextensionui';

export class DeploymentTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployment';
    public readonly contextValue: string = DeploymentTreeItem.contextValue;
    public readonly childTypeLabel: string = 'logs';
    public label: string;
    public active: boolean;

    constructor(parent: AzureParentTreeItem, id: string, active: boolean) {
        super(parent);
        this.active = active;
        this.id = id;
        this.label = this.active ? this.id + ' (Active)' : this.id;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<TreeItem[]> {
        const deploymentLogs: Deployment = await this.root.client.listDeploymentLogs(this.id);
        return deploymentLogs.map((log: Deployment) => new TreeItem(log.name!));
    }
}
