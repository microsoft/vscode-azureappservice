/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import * as path from 'path';
import { OutputChannel, TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import { DeploymentSlotSwapper } from '../DeploymentSlotSwapper';
import { AppServiceDataProvider } from './AppServiceExplorer';
import { AppSettingsNode } from './AppSettingsNodes';
import { NodeBase } from './NodeBase';
import { SiteNodeBase } from './SiteNodeBase';

export class DeploymentSlotNode extends SiteNodeBase {
    constructor(
        label: string,
        site: WebSiteModels.Site,
        subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, site, subscription, treeDataProvider, parentNode);
    }

    public getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'deploymentSlot',
            iconPath: {
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
            }
        };
    }

    public async getChildren(): Promise<NodeBase[]> {
        return [
            new AppSettingsNode(this.site, this.subscription, this.getTreeDataProvider<AppServiceDataProvider>(), this)
        ];
    }

    public async swapDeploymentSlots(output: OutputChannel): Promise<void> {
        const wizard = new DeploymentSlotSwapper(output, this.azureAccount, this);
        await wizard.run();
    }
}
