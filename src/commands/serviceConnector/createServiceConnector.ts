/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ServiceConnectorGroupTreeItem, createLinker } from "@microsoft/vscode-azext-serviceconnector";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { pickWebApp } from "../../utils/pickWebApp";

export async function createServiceConnector(context: IActionContext, item?: SiteTreeItem | ServiceConnectorGroupTreeItem): Promise<void> {
    item ??= await pickWebApp(context);
    if (item instanceof ServiceConnectorGroupTreeItem) {
        item = <SiteTreeItem>item.parent;
    }

    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('createServiceConnector', 'Create connection'),
    }

    await createLinker(activityContext, item.id, item.subscription);
    await item.refresh(context);
}
