/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';

const openLogStreamCommand: string = 'appService.OpenLogStream';
const connectLogStream: string = 'Connect to log stream...';

export class LogStreamTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'logstream';
    public readonly contextValue: string = LogStreamTreeItem.contextValue;
    public parent: FolderTreeItem;
    public commandId: string = openLogStreamCommand;
    public label: string = connectLogStream;

    constructor(parent: FolderTreeItem) {
        super(parent);
    }
}
