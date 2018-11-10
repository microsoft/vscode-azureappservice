/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { ext } from 'vscode-azureappservice/lib/extensionVariables';
import { AzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';

export class DeploymentTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployment';
    public readonly contextValue: string = DeploymentTreeItem.contextValue;
    public label: string;
    public active: boolean;
    public receivedTime: Date;
    public parent: DeploymentsTreeItem;
    private _kuduClient: KuduClient;
    private _deployResult: DeployResult;

    constructor(parent: DeploymentsTreeItem, deployResult: DeployResult, kuduClient: KuduClient) {
        super(parent);
        this._deployResult = deployResult;
        if (!this._deployResult.receivedTime || !this._deployResult.id || !this._deployResult.message || this._deployResult.active === undefined) {
            throw new Error('Invalid Deployment Result.');
        }
        this._kuduClient = kuduClient;
        this.receivedTime = this._deployResult.receivedTime;
        this.active = this._deployResult.active;
        this.id = this._deployResult.id;
        const displayLabel: string = `${this.id.substring(0, 5)} - ${this._deployResult.message.substring(0, 50)}`;
        this.label = this.active ? `(Active) ${displayLabel}` : displayLabel;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'Git_Commit_16x.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'Git_Commit_16x.svg')
        };
    }

    public async redeployDeployment(): Promise<void> {
        const redeploying: string = `Redeploying commit "${this.id}" to "${this.parent.root.client.fullName}"`;
        const deployed: string = `Commit "${this.id}" has been redeployed to "${this.parent.root.client.fullName}".`;
        window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            ext.outputChannel.appendLine(redeploying);
            // tslint:disable-next-line:no-non-null-assertion
            await this._kuduClient.deployment.deploy1(this.id!);
            await this.parent.refresh();
            ext.outputChannel.appendLine(deployed);
        });
    }

    public async getDeploymentLogs(): Promise<string> {
        // tslint:disable-next-line:no-non-null-assertion
        const logEntries: LogEntry[] = await this._kuduClient.deployment.getLogEntry(this.id!);
        let data: string = '';
        for (const logEntry of logEntries) {
            if (logEntry.logTime && logEntry.message) {
                data += `${logEntry.logTime.toLocaleTimeString()} - ${logEntry.message} \n`;
            }
            if (logEntry.detailsUrl && logEntry.id) {
                // tslint:disable-next-line:no-non-null-assertion
                const detailedLogEntries: LogEntry[] = await this._kuduClient.deployment.getLogEntryDetails(this.id!, logEntry.id);
                for (const detailedEntry of detailedLogEntries) {
                    if (detailedEntry.logTime && detailedEntry.message) {
                        data += `${detailedEntry.logTime.toLocaleTimeString()} - ${detailedEntry.message} \n`;
                    }
                }
            }
        }
        return data;
    }
}

export class ConnectToGitHubTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public readonly label: string = "Connect to a GitHub repository...";
    public readonly contextValue: string = "ConnectToGithub";
    public readonly commandId: string = 'appService.ConnectToGitHub';
    public parent: DeploymentsTreeItem;

    public constructor(parent: DeploymentsTreeItem) {
        super(parent);
    }
}
