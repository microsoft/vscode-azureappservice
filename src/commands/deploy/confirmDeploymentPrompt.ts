/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';
import { commands, MessageItem, Uri, window, workspace } from "vscode";
import { IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { AppServiceDialogResponses, configurationSettings } from '../../constants';
import { ext } from '../../extensionVariables';
import { delay } from '../../utils/delay';
import { updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import { IDeployContext, WebAppSource } from "./IDeployContext";

export async function confirmDeploymentPrompt(deployContext: IDeployContext, context: IActionContext, appName: string): Promise<void> {
    const warning: string = `Are you sure you want to deploy to "${appName}"? This will overwrite any previous deployment and cannot be undone.`;
    context.telemetry.properties.cancelStep = 'confirmDestructiveDeployment';
    const items: MessageItem[] = [AppServiceDialogResponses.deploy];
    const resetDefault: MessageItem = { title: 'Reset default' };
    if (deployContext.webAppSource === WebAppSource.setting) {
        items.push(resetDefault);
    }

    // a temporary workaround for this issue:
    // https://github.com/Microsoft/vscode-azureappservice/issues/844
    await delay(500);

    const result: MessageItem = await ext.ui.showWarningMessage(warning, { modal: true }, ...items);
    if (result === resetDefault) {
        const settingsPath = join(deployContext.workspace.uri.fsPath, '.vscode', 'settings.json');
        const doc = await workspace.openTextDocument(Uri.file(settingsPath));
        window.showTextDocument(doc);
        await updateWorkspaceSetting(configurationSettings.defaultWebAppToDeploy, '', deployContext.workspace.uri.fsPath);

        // If resetDefault button was clicked we ask what and where to deploy again
        // don't wait
        commands.executeCommand('appService.Deploy');
        context.telemetry.properties.cancelStep = 'resetDefault';
        throw new UserCancelledError();
    }
    deployContext.telemetry.properties.cancelStep = '';
}
