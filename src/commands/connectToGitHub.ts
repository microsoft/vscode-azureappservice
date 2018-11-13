import { editScmType, ISiteTreeRoot } from "vscode-azureappservice";
import { AzureTreeItem, IActionContext } from "vscode-azureextensionui";
import { ScmType } from "../constants";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function connectToGitHub(node: AzureTreeItem<ISiteTreeRoot>, context: IActionContext): Promise<void> {
    const siteTreeItem: ISiteTreeRoot = node.root;
    await editScmType(siteTreeItem.client, node, context, ScmType.GitHub);
    // tslint:disable-next-line:no-non-null-assertion
    await node.parent!.refresh();
}
