/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { createLinker } from "@microsoft/vscode-azext-serviceconnector";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { pickWebApp } from "../../utils/pickWebApp";

export async function createServiceConnector(context: IActionContext, item?: SiteTreeItem): Promise<void> {
    item ??= await pickWebApp(context);

    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('createServiceConnector', 'Create Service Connector'),
    }

    await createLinker(activityContext, item.id.includes('/ServiceConnector') ? item.id.split('/ServiceConnector')[0] : item.id, item.subscription);

    if (item.id.includes('/ServiceConnector')) {
        await item.parent?.refresh(context);
    } else {
        await item.refresh(context);
    }
}
