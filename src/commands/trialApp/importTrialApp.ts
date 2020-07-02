/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ProgressLocation, window } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppContext } from '../../constants';
import { ITrialAppContext } from '../../explorer/trialApp/ITrialAppContext';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';

export async function importTrialApp(context: IActionContext, loginSession: string): Promise<void> {

    await window.withProgress({ location: ProgressLocation.Notification, cancellable: false }, async p => {
        p.report({ message: localize('importingTrialApp', 'Importing trial app...') });
        ext.azureAccountTreeItem.trialAppNode = await TrialAppTreeItem.createTrialAppTreeItem(ext.azureAccountTreeItem, loginSession);
        const trialAppNode = ext.azureAccountTreeItem.trialAppNode;

        // When a trial app is expired, sometimes we can get the metadata still, if we can
        // then we know it's expired if the timeLeft is undefined
        if (trialAppNode.client.metadata.timeLeft === undefined) {
            throw new Error(localize('trialAppExpired', 'Trial app is expired. Could not import.'));
        }

        const expirationDate: number = Date.now() + (trialAppNode.client.metadata.timeLeft * 1000);
        const trialAppContext: ITrialAppContext = {
            name: trialAppNode.client.fullName,
            expirationDate: expirationDate,
            loginSession: loginSession
        };
        context.telemetry.properties.timeLeft = String(trialAppNode.metadata.timeLeft);
        ext.context.globalState.update(TrialAppContext, trialAppContext);
        await commands.executeCommand('workbench.view.extension.azure');
        await ext.azureAccountTreeItem.refresh();
    });
}
