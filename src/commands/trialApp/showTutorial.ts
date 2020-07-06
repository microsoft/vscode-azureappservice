/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, extensions, Uri, window } from 'vscode';
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
            window.showInformationMessage(localize('mustInstallDidact', 'The Didact extension must be installed to view the trial app tutorial.'));
        }
        if (await installExtension(extensionId)) {
            const tutorialUri: Uri = Uri.file(ext.context.asAbsolutePath('resources/TrialApp.didact.md'));
            commands.executeCommand('vscode.didact.startDidact', tutorialUri);
            context.telemetry.properties.installedDidact = 'true';
            context.telemetry.properties.trialTimeRemaining = String(trialAppNode.metadata.timeLeft);
        }
    } else {
        throw Error(localize('trialAppNotFound', 'Trial app not found.'));
    }
}
