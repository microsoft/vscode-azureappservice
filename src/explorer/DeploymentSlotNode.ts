/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as path from 'path';
import { NodeBase } from './NodeBase';
import { SiteNodeBase } from './SiteNodeBase';
import { AppSettingsNode } from './AppSettingsNodes';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { SubscriptionModels } from 'azure-arm-resource';
import { TreeItem, TreeItemCollapsibleState, OutputChannel } from 'vscode';
import { DeploymentSlotSwapper } from '../DeploymentSlotSwapper';

export class DeploymentSlotNode extends SiteNodeBase {
    constructor(label: string,
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, site, subscription, treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'deploymentSlot',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_16x_vscode.svg')
            }
        }
    }

    async getChildren(): Promise<NodeBase[]> {
        return [
            new AppSettingsNode(this.site, this.subscription, this.getTreeDataProvider<AppServiceDataProvider>(), this)
        ];
    }

    async swapDeploymentSlots(output: OutputChannel): Promise<void> {
        const wizard = new DeploymentSlotSwapper(output, this.azureAccount, this);
        await wizard.run();
    }
}