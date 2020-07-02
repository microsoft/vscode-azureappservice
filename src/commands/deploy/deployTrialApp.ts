/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ProgressLocation, window } from 'vscode';
import { IDeployContext, localGitDeploy } from 'vscode-azureappservice';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { localize } from '../../localize';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

export async function deployTrialApp(context: IDeployContext, node: TrialAppTreeItem): Promise<void> {
    context.telemetry.properties.trialApp = 'true';
    await node.runWithTemporaryDescription("Deploying...", async () => {
        const commit: boolean = context.workspaceFolder.name === node.metadata.siteName;
        const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', node.client.fullName, `${ext.prefix}.showOutputChannel`);
        return await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
            await localGitDeploy(node.client, { fsPath: context.workspaceFolder.uri.fsPath, branch: 'RELEASE', commit: commit }, context);
        });
    });
    showDeployCompletedMessage(node);
}
