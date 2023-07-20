/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { validateLinker } from "@microsoft/vscode-azext-serviceconnector";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { pickWebApp } from "../../utils/pickWebApp";

export async function validateServiceConnector(context: IActionContext, item?: SiteTreeItem): Promise<void> {
    item ??= await pickWebApp(context);
    const activityContext = {
        ...context,
        ...await createActivityContext(),
        activityTitle: localize('validateServiceConnector', 'Validate Service Connector'),
    }

    const id = item.id.includes('/ServiceConnector') ? item.id.split('/ServiceConnector')[0] : item.id;
    const name = item.id.includes('/ServiceConnector') ? item.id.split('/ServiceConnector/')[1] : undefined;

    await validateLinker(activityContext, id, item.subscription, name);
}
