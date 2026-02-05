/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAzureUtilsExtensionVariables, type IAzureUtilsExtensionVariables } from "@microsoft/vscode-azext-azureutils";
import { registerUIExtensionVariables, type IAzExtOutputChannel, type IExperimentationServiceAdapter, type UIExtensionVariables } from "@microsoft/vscode-azext-utils";
import { type AzureHostExtensionApi } from "@microsoft/vscode-azext-utils/hostapi";
import { type ExtensionContext } from "vscode";
import { type AppServiceFileSystem } from "./AppServiceFileSystem";
import { type AzureAccountTreeItem } from "./tree/AzureAccountTreeItem";

/**
 * Interface for extension variables used throughout the extension
 */
export interface IAppServiceExtensionVariables extends UIExtensionVariables, IAzureUtilsExtensionVariables {
    prefix: string;
    outputChannel: IAzExtOutputChannel;
    context: ExtensionContext;
    ignoreBundle?: boolean;
    fileSystem: AppServiceFileSystem;
    azureAccountTreeItem: AzureAccountTreeItem;
    experimentationService: IExperimentationServiceAdapter;
    rgApi: AzureHostExtensionApi;
}

class UninitializedExtensionVariables implements IAppServiceExtensionVariables {
    private _error: Error = new Error('"registerExtensionVariables" must be called before using the vscode-azureappservice extension.');

    public get context(): ExtensionContext {
        throw this._error;
    }

    public get outputChannel(): IAzExtOutputChannel {
        throw this._error;
    }

    public get prefix(): string {
        return 'appService';
    }

    public get ignoreBundle(): boolean | undefined {
        return undefined;
    }

    public get fileSystem(): AppServiceFileSystem {
        throw this._error;
    }

    public get azureAccountTreeItem(): AzureAccountTreeItem {
        throw this._error;
    }

    public get experimentationService(): IExperimentationServiceAdapter {
        throw this._error;
    }

    public get rgApi(): AzureHostExtensionApi {
        throw this._error;
    }
}

/**
 * Container for common variables used throughout the extension.
 * Must be initialized with registerExtensionVariables before use.
 */
export let ext: IAppServiceExtensionVariables = new UninitializedExtensionVariables();

/**
 * Call this to register extension variables. Must be called during activation.
 */
export function registerExtensionVariables(extVars: IAppServiceExtensionVariables): void {
    if (ext === extVars) {
        // already registered
        return;
    }

    ext = extVars;
    registerUIExtensionVariables(extVars);
    registerAzureUtilsExtensionVariables(extVars);
}
