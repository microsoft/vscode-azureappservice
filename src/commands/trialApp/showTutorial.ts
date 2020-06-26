/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, Uri } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { localize } from '../../localize';
import { installExtension } from '../../utils/installExtension';
import { ext } from './../../extensionVariables';

export async function showTutorial(_context: IActionContext): Promise<void> {
    const extensionId: string = 'redhat.vscode-didact';

    const trialAppNode: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppNode;

    if (trialAppNode) {
        if (await installExtension(extensionId)) {
            const tutorialUri: Uri = Uri.file(ext.context.asAbsolutePath('resources/TrialApp.didact.md'));
            commands.executeCommand('vscode.didact.startDidact', tutorialUri);
        }
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
