/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from 'vscode';
import { SiteClient } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { deploy } from '../commands/deploy';
import { AppServiceDialogResponses } from '../constants';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath, IThemedIconPath } from '../utils/pathUtils';
import { DeploymentSlotsTreeItem } from './DeploymentSlotsTreeItem';
import { SiteTreeItem } from './SiteTreeItem';

export class DeploymentSlotTreeItem extends SiteTreeItem {
    public static contextValue: string = 'deploymentSlot';
    public readonly contextValue: string = DeploymentSlotTreeItem.contextValue;
    public readonly parent: DeploymentSlotsTreeItem;

    public constructor(parent: DeploymentSlotsTreeItem, client: SiteClient) {
        super(parent, client);
    }

    public get label(): string {
        return nonNullProp(this.root.client, 'slotName');
    }

    public get iconPath(): IThemedIconPath {
        return getThemedIconPath('DeploymentSlot_color');
    }
    public promptToDeploy(context: IActionContext): void {
        const createdNewSlotMsg: string = `Created new slot "${this.root.client.fullName}": https://${this.root.client.defaultHostName}`;

        // Note: intentionally not waiting for the result of this before returning
        window.showInformationMessage(createdNewSlotMsg, AppServiceDialogResponses.deploy, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
            if (result === AppServiceDialogResponses.viewOutput) {
                ext.outputChannel.show();
            } else if (result === AppServiceDialogResponses.deploy) {
                context.telemetry.properties.deploy = 'true';
                await deploy(context, false, this);
            }
        });
    }
}
