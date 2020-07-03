/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { ISiteTreeItem } from '../../explorer/ISiteTreeItem';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { ext } from '../../extensionVariables';

export function addTrialAppTelemetry(context: IActionContext, node: ISiteTreeItem): void {
    if (node instanceof TrialAppTreeItem) {
        context.telemetry.properties.trialApp = 'true';
        context.telemetry.properties.trialTimeRemaining = String(node.metadata.timeLeft);
        context.telemetry.properties.loggedIn = ext.azureAccountTreeItem.isLoggedIn ? 'true' : 'false';
    }
}
