/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, ProgressLocation, window } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppLoginSession } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';

export async function importTrialApp(_context: IActionContext, loginSession?: string): Promise<void> {

    if (!loginSession) {
        throw Error(localize('noLoginSession', 'No loginSession provided'));
    }

    window.withProgress({ location: ProgressLocation.Notification, cancellable: false }, async p => {
        p.report({ message: localize('importingTrialApp', 'Importing trial app...') });

        await commands.executeCommand('workbench.view.extension.azure');
        ext.context.globalState.update(TrialAppLoginSession, loginSession);
        await ext.azureAccountTreeItem.refresh();
    });
}
