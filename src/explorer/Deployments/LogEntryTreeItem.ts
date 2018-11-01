/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { TextDocument, window, workspace } from 'vscode';
import { getKuduClient, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { LogEntry } from 'vscode-azurekudu/lib/models';
import { DeploymentTreeItem } from './DeploymentTreeItem';

export class LogEntryTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'logEntry';
    public readonly contextValue: string = LogEntryTreeItem.contextValue;
    public commandId: string = 'appService.getDeploymentLog';
    public label: string;
    public id: string;
    public logTime: Date;
    public detailsUrl?: string;
    public parent: DeploymentTreeItem;

    constructor(parent: DeploymentTreeItem, id: string, message: string, logTime: Date, detailsUrl?: string) {
        super(parent);
        this.id = <string>id;
        this.label = message;
        this.logTime = logTime;
        this.detailsUrl = detailsUrl;
    }

    public get iconPath(): { light: string, dark: string } | undefined {
        return this.detailsUrl ? {
            light: join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'File_16x.svg'),
            dark: join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'File_16x.svg')
        } : undefined;
    }

    public async getDeploymentLog(): Promise<void> {
        if (this.detailsUrl) {
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            const detailedLogEntries: LogEntry[] = await kuduClient.deployment.getLogEntryDetails(this.parent.id, this.id);
            let data: string = '';
            for (const logEntry of detailedLogEntries) {
                data += `${logEntry.logTime!.toUTCString()} - ${logEntry.message} \n`;
            }
            const document: TextDocument = await workspace.openTextDocument({
                content: data
            });
            await window.showTextDocument(document);
        }
    }
}
