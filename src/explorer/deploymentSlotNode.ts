/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import { NodeBase } from './nodeBase';
import { AppSettingsNode } from './appSettingsNodes';
import { AppServiceDataProvider } from './appServiceExplorer';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import { DeploymentSlotsNode } from './deploymentSlotsNode';
import { DeploymentSlotSwapper } from '../deploymentSlotActions';
import { AzureAccountWrapper } from '../azureAccountWrapper';

export class DeploymentSlotNode extends NodeBase {
    constructor(readonly label: string, 
        readonly site: WebSiteModels.Site, 
        readonly subscription: SubscriptionModels.Subscription,
        treeDataProvider: AppServiceDataProvider,
        parentNode: NodeBase) {
        super(label, treeDataProvider, parentNode);
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

    browse(): void {
        const defaultHostName = this.site.defaultHostName;
        const isSsl = this.site.hostNameSslStates.findIndex((value, index, arr) => 
            value.name === defaultHostName && value.sslState === "Enabled");
        const uri = `${isSsl ? 'https://' : 'http://'}${defaultHostName}`;
        opn(uri);
    }

    openInPortal(): void {
        const portalEndpoint = 'https://portal.azure.com';
        const deepLink = `${portalEndpoint}/${this.subscription.tenantId}/#resource${this.site.id}`;
        opn(deepLink);
    }

    async swapDeploymentSlots(output: OutputChannel): Promise<void> {
        const wizard = new DeploymentSlotSwapper(output, this.azureAccount, this);
        const result = await wizard.run();
    }

    private get azureAccount(): AzureAccountWrapper {
        return this.getTreeDataProvider<AppServiceDataProvider>().azureAccount;
    }    
}