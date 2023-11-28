/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IActionContext } from '@microsoft/vscode-azext-utils';
import { type ISiteTreeItem } from '../tree/ISiteTreeItem';
import { pickWebApp } from '../utils/pickWebApp';

export async function browseWebsite(context: IActionContext, node?: ISiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);
    await node.browse();
}
