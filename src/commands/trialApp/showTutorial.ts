/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, extensions, Uri } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { localize } from '../../localize';
import { installExtension } from '../../utils/installExtension';
import { ext } from './../../extensionVariables';

export async function showTutorial(context: IActionContext): Promise<void> {
    const trialAppNode: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppNode;

    if (trialAppNode) {
        const extensionId: string = 'redhat.vscode-didact';
        if (!extensions.getExtension(extensionId)) {
            await context.ui.showWarningMessage(localize('didactInstall', 'You must have the "Didact" extension installed to perform this operation.'), { title: 'Install' });
            if (await installExtension(extensionId)) {
                context.telemetry.properties.installedDidact = 'true';
            } else {
                return;
            }
        }
        const tutorialUri: Uri = Uri.file(ext.context.asAbsolutePath('resources/TrialApp.didact.md'));
        context.telemetry.properties.trialTimeRemaining = String(trialAppNode.metadata.timeLeft);
        commands.executeCommand('vscode.didact.startDidact', tutorialUri);
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
