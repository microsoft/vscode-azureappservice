/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';

export async function cloneTrialApp(_context: IActionContext, node: TrialAppTreeItem): Promise<void> {
    await commands.executeCommand('git.clone', node?.metadata.gitUrl);
}
