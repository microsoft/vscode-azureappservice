/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, extensions, Uri } from 'vscode';
import { AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { delay } from '../../utils/delay';
import { ext } from './../../extensionVariables';

export async function showTutorial(context: IActionContext, node?: TrialAppTreeItem): Promise<void> {

    const timeoutInSeconds: number = 60;
    const maxTime: number = Date.now() + timeoutInSeconds * 1000;
    const extensionId: string = 'redhat.vscode-didact';

    if (!node) {
        const children: AzExtTreeItem[] = await ext.azureAccountTreeItem.getCachedChildren(context);
        children.forEach((child: AzExtTreeItem) => {
            if (child instanceof TrialAppTreeItem) {
                node = child;
            }
        });
    }

    if (extensions.getExtension(extensionId)) {
        showDidact();
    } else {
        const commandToRun: string = 'extension.open';
        commands.executeCommand(commandToRun, extensionId);

        while (Date.now() < maxTime) {

            if (extensions.getExtension(extensionId)) {
                showDidact();
                break;
            } else {
                await delay(5000);
            }
        }
    }
}

function showDidact(): void {
    const tutorialUri: Uri = Uri.file(ext.context.asAbsolutePath('resources/TrialApp.didact.md'));
    commands.executeCommand('vscode.didact.startDidact', tutorialUri);
}
