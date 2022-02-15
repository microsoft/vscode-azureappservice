/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { getIconPath } from '../utils/pathUtils';

export abstract class SiteTreeItemBase extends AzExtParentTreeItem {
    public readonly abstract contextValue: string;
    public readonly abstract label: string;

    public get iconPath(): TreeItemIconPath {
        return getIconPath('WebApp');
    }

    constructor(parent: AzExtParentTreeItem) {
        super(parent);
    }
}
