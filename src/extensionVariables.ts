/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, OutputChannel, TreeView } from "vscode";
import { AzExtTreeDataProvider, AzExtTreeItem, IAzureUserInput, ITelemetryReporter } from "vscode-azureextensionui";
import { AzureAccountTreeItem } from "./explorer/AzureAccountTreeItem";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export let outputChannel: OutputChannel;
    export let ui: IAzureUserInput;
    export let reporter: ITelemetryReporter;
    export let context: ExtensionContext;

    export let tree: AzExtTreeDataProvider;
    export let treeView: TreeView<AzExtTreeItem>;
    export let azureAccountTreeItem: AzureAccountTreeItem;
}
