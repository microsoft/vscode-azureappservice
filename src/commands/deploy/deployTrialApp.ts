/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ProgressLocation, window } from 'vscode';
import { localGitDeploy } from 'vscode-azureappservice';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { localize } from '../../localize';
import { delay } from '../../utils/delay';
import { IDeployContext } from './IDeployContext';
import { showDeployCompletedMessage } from './showDeployCompletedMessage';

export async function deployTrialApp(deployContext: IDeployContext, node: TrialAppTreeItem): Promise<void> {
    await node.runWithTemporaryDescription("Deploying...", async () => {
        const commit: boolean = deployContext.workspace.name === node.metadata.siteName;
        const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', node.client.fullName, `${ext.prefix}.showOutputChannel`);
        return await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
            await localGitDeploy(node.client, { fsPath: deployContext.workspace.uri.fsPath, branch: 'RELEASE', commit: commit }, deployContext);
            // Delay for 15 seconds to make sure changes are reflected immediately after deploy 'finishes'
            await delay(15000);
        });
    });
    showDeployCompletedMessage(node);
}
