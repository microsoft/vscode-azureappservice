/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogStream, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';
const openLogStreamCommand: string = 'appService.OpenLogStream';
const showLogStreamCommand: string = 'appService.ShowLogStream';
const showLogStream: string = 'Show log stream';
const connectLogStream: string = 'Connect to log stream...';

export class LogStreamTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'logstream';
    public readonly contextValue: string = LogStreamTreeItem.contextValue;
    public logStream?: ILogStream;
    public parent: FolderTreeItem;
    public commandId: string = openLogStreamCommand;
    private _connected: boolean = false;

    constructor(parent: FolderTreeItem) {
        super(parent);
    }

    public get label(): string {
        return this._connected ? showLogStream : connectLogStream;
    }

    public async refreshLabelImpl(): Promise<void> {
        if (this.logStream) {
            this._connected = this.logStream.isConnected;
            this.commandId = this.logStream.isConnected ? showLogStreamCommand : openLogStreamCommand;
        } else {
            this._connected = false;
            this.commandId = openLogStreamCommand;
        }
    }
}
