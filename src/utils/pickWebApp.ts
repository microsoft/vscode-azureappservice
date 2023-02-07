/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ITreeItemPickerContext } from "@microsoft/vscode-azext-utils";
import { webAppFilter } from "../constants";
import { ext } from "../extensionVariables";
import { SiteTreeItem } from "../tree/SiteTreeItem";

export async function pickWebApp(context: ITreeItemPickerContext): Promise<SiteTreeItem> {
    return await ext.rgApi.pickAppResource<SiteTreeItem>(context, {
        filter: webAppFilter
    });
}
