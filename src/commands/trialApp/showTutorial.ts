/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, Uri } from 'vscode';
import { AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { installExtension } from '../../utils/installExtension';
import { ext } from './../../extensionVariables';

export async function showTutorial(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {
    const extensionId: string = 'redhat.vscode-didact';

    if (!node) {
        const children: AzExtTreeItem[] = await ext.azureAccountTreeItem.getCachedChildren(context);
        children.forEach((child: AzExtTreeItem) => {
            if (child instanceof TrialAppTreeItem) {
                node = child;
            }
        });
    }

    if (await installExtension(extensionId)) {
        const tutorialUri: Uri = Uri.file(ext.context.asAbsolutePath('resources/TrialApp.didact.md'));
        commands.executeCommand('vscode.didact.startDidact', tutorialUri);
    }
}
