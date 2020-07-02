/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebsiteOS } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { TrialAppTreeItem } from '../../explorer/trialApp/TrialAppTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { createWebApp } from '../createWebApp/createWebApp';
import { deploy } from '../deploy/deploy';

export async function transferToSubscription(context: IActionContext): Promise<void> {
    const trialAppNode: TrialAppTreeItem | undefined = ext.azureAccountTreeItem.trialAppNode;
    context.telemetry.properties.timeLeft = String(trialAppNode?.metadata.timeLeft);

    const newSite: WebAppTreeItem = await createWebApp(Object.assign(context, { newSiteRuntime: 'NODE|12-lts', newSiteOS: WebsiteOS.linux, trialApp: true }), undefined, true);
    await deploy(context, newSite, undefined, true);
}
