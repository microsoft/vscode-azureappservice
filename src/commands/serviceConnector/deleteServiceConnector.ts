/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ServiceConnectorTreeItem, deleteLinker } from "@microsoft/vscode-azext-serviceconnector";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { pickWebApp } from "../../utils/pickWebApp";

export async function deleteServiceConnector(context: IActionContext, item?: SiteTreeItem | ServiceConnectorTreeItem): Promise<void> {
    let serviceConnectorName = undefined
    item ??= await pickWebApp(context);

    if (item instanceof ServiceConnectorTreeItem) {
        serviceConnectorName = item.label;
        item = <SiteTreeItem>item.parent?.parent;
    }

    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('deleteServiceConnector', 'Delete Service Connector'),
    }

    await deleteLinker(activityContext, item.id, item.subscription, serviceConnectorName);
    await item.refresh(context);
}
