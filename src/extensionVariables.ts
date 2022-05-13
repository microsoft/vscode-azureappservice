/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzExtOutputChannel, IExperimentationServiceAdapter } from "@microsoft/vscode-azext-utils";
import { AzureHostExtensionApi } from "@microsoft/vscode-azext-utils/hostapi";
import { ExtensionContext } from "vscode";
import { AppServiceFileSystem } from "./AppServiceFileSystem";
import { AzureAccountTreeItem } from "./tree/AzureAccountTreeItem";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export let outputChannel: IAzExtOutputChannel;
    export let context: ExtensionContext;
    export let ignoreBundle: boolean | undefined;
    export let fileSystem: AppServiceFileSystem;
    export const prefix: string = 'appService';

    export let azureAccountTreeItem: AzureAccountTreeItem;
    export let experimentationService: IExperimentationServiceAdapter;
    export let rgApi: AzureHostExtensionApi;
}
