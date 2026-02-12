/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DeploymentsTreeItem } from '@microsoft/vscode-azext-azureappservice';
import type { AppSettingTreeItem, AppSettingsTreeItem } from '@microsoft/vscode-azext-azureappsettings';
import type { SubscriptionTreeItemBase } from '@microsoft/vscode-azext-azureutils';
import type { IActionContext, IAzExtOutputChannel } from '@microsoft/vscode-azext-utils';
import type { AzureHostExtensionApi } from '@microsoft/vscode-azext-utils/hostapi';
import type * as vscode from 'vscode';
import type { ScmType } from './constants';
import type { SiteTreeItem } from './tree/SiteTreeItem';

/**
 * Test-only API for accessing internal extension state.
 * This API is only available when VSCODE_RUNNING_TESTS environment variable is set.
 * It should NEVER be used in production code.
 */
export interface TestApi {
    /**
     * API version for the test API
     */
    apiVersion: '99.0.0';

    /**
     * Access to select internal extension variables (exposed as functions to avoid accidental mutation).
     */
    extensionVariables: {
        getOutputChannel(): IAzExtOutputChannel | undefined;
        getContext(): vscode.ExtensionContext | undefined;
        getRgApi(): AzureHostExtensionApi | undefined;
        getIgnoreBundle(): boolean | undefined;
    };

    /**
     * Testing utilities for overriding internal state.
     */
    testing: {
        setOverrideRgApi(api: AzureHostExtensionApi | undefined): void;
        setIgnoreBundle(ignoreBundle: boolean | undefined): void;
    };

    /**
     * Commands exposed for testing.
     */
    commands: {
        createWebApp(context: IActionContext, node?: SubscriptionTreeItemBase): Promise<SiteTreeItem>;
        createWebAppAdvanced(context: IActionContext, node?: SubscriptionTreeItemBase): Promise<SiteTreeItem>;
        deploy(context: IActionContext, zipFilePath?: vscode.Uri): Promise<void>;

        editScmType(context: IActionContext, node?: SiteTreeItem | DeploymentsTreeItem, _nodes?: (SiteTreeItem | DeploymentsTreeItem)[], newScmType?: ScmType, showToast?: boolean): Promise<void>;

        addAppSetting(context: IActionContext, node?: AppSettingsTreeItem): Promise<void>;
        deleteAppSetting(context: IActionContext, node?: AppSettingTreeItem): Promise<void>;
        deleteWebApp(context: IActionContext, node?: SiteTreeItem): Promise<void>;
    };
}
