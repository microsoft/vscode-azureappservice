/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ISiteTreeRoot } from 'vscode-azureappservice';
import { AzureTreeItem } from 'vscode-azureextensionui';
import { FolderTreeItem } from './FolderTreeItem';

export class LogStreamTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'logstream';
    public readonly contextValue: string = LogStreamTreeItem.contextValue;
    public parent: FolderTreeItem;
    public commandId: string = 'appService.OpenLogStream';
    public label: string = 'Connect to Log Stream...';

    constructor(parent: FolderTreeItem) {
        super(parent);
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'StartLog.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'StartLog.svg')
        };
    }
}
