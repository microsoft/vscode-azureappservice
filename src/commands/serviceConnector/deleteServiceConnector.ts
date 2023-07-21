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
    item ??= await pickWebApp(context);
    if (item instanceof SiteTreeItem) {
        item = <ServiceConnectorTreeItem><unknown>item.parent;
    }

    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('deleteServiceConnector', 'Delete Service Connector'),
    }

    await deleteLinker(activityContext, item.resourceId || item.id, item.subscription, item.resourceId ? item.label : undefined);

    if (item.resourceId) {
        await item.parent?.refresh(context);
    } else {
        await item.refresh(context);
    }
}
