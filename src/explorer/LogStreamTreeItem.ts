/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLogStreamId, getLogStreams, ILogStream, ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';

const openLogStreamCommand: string = 'appService.OpenLogStream';
const stopLogStreamCommand: string = 'appService.StopLogStream';
const disconnectLogStream: string = 'Disconnect log stream...';
const connectLogStream: string = 'Connect to log stream...';

export class LogStreamTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'logstream';
    public readonly contextValue: string = LogStreamTreeItem.contextValue;
    public commandId: string = openLogStreamCommand;
    private _connected: boolean = false;

    constructor(parent: AzureParentTreeItem) {
        super(parent);
    }

    public get label(): string {
        return this._connected ? disconnectLogStream : connectLogStream;
    }

    public async refreshLabelImpl(): Promise<void> {
        const logStreams: Map<string, ILogStream> = getLogStreams();
        const logStreamId: string = getLogStreamId(this.root.client, '');
        const logStream: ILogStream | undefined = logStreams.get(logStreamId);
        this._connected = logStream ? logStream.isConnected : false;
        this.commandId = logStream && logStream.isConnected ? stopLogStreamCommand : openLogStreamCommand;
    }
}
