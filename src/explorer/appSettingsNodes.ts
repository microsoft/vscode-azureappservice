/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WebSiteModels from '../../node_modules/azure-arm-website/lib/models';
import * as opn from 'opn';
import * as path from 'path';
import { NodeBase } from './nodeBase';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event, OutputChannel } from 'vscode';
import WebSiteManagementClient = require('azure-arm-website');

export class AppSettingsNode extends NodeBase {
    constructor(readonly site: WebSiteModels.Site, readonly subscription: SubscriptionModels.Subscription) {
        super('Application Settings');
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: "applicationSettings",
            iconPath: { 
                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Settings_16x_vscode.svg'),
                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Settings_16x_vscode.svg')
            }
        }
    }
}