/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { deleteLinker } from "@microsoft/vscode-azext-serviceconnector";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { pickWebApp } from "../../utils/pickWebApp";

export async function deleteServiceConnector(context: IActionContext, item?: SiteTreeItem): Promise<void> {
    item ??= await pickWebApp(context);
    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('deleteServiceConnector', 'Delete Service Connector'),
    }

    const id = item.id.includes('/ServiceConnector') ? item.id.split('/ServiceConnector')[0] : item.id;
    const name = item.id.includes('/ServiceConnector') ? item.id.split('/ServiceConnector/')[1] : undefined;

    await deleteLinker(activityContext, id, item.subscription, name);

    if (item.id.includes('/ServiceConnector')) {
        await item.parent?.refresh(context);
    } else {
        await item.refresh(context);
    }
}
