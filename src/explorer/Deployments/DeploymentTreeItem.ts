/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';
import { LogEntryTreeItem } from './LogEntryTreeItem';

export class DeploymentTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployment';
    public readonly contextValue: string = DeploymentTreeItem.contextValue;
    public readonly childTypeLabel: string = 'logs';
    public label: string;
    public active: boolean;
    public lastSuccessEndTime: Date;
    public parent: DeploymentsTreeItem;
    private _kuduClient: KuduClient;
    private _deployResult: DeployResult;

    constructor(parent: DeploymentsTreeItem, deployResult: DeployResult, kuduClient: KuduClient) {
        super(parent);
        const deployResultError: string = 'The DeployResult object is invalid.';
        this._deployResult = deployResult;
        if (!this._deployResult.lastSuccessEndTime || !this._deployResult.id || this._deployResult.active === undefined) {
            throw new Error(deployResultError);
        }
        this._kuduClient = kuduClient;
        this.lastSuccessEndTime = this._deployResult.lastSuccessEndTime;
        this.active = this._deployResult.active;
        this.id = this._deployResult.id;
        this.label = this.active ? `${this.id} (Active)` : this.id;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<LogEntryTreeItem[]> {
        // tslint:disable-next-line:no-non-null-assertion
        const logEntries: LogEntry[] = await this._kuduClient.deployment.getLogEntry(this.id!);
        return logEntries.map((log: LogEntry) => {
            return new LogEntryTreeItem(this, log.id, log.message, log.logTime, log.detailsUrl);
        });
    }

    public compareChildrenImpl(ti1: LogEntryTreeItem, ti2: LogEntryTreeItem): number {
        // orders with the first entry to the last entry
        return ti1.logTime.valueOf() - ti2.logTime.valueOf();
    }

    public async redeployDeployment(): Promise<void> {
        // tslint:disable-next-line:no-non-null-assertion
        await this._kuduClient.deployment.deploy1(this.id!);
        await this.parent.refresh();
    }
}
