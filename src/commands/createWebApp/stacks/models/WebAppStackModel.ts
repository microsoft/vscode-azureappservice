/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppInsightsSettings, AppStack, CommonSettings, GitHubActionSettings } from './AppStackModel';

// Types copied from here:
// https://github.com/Azure/azure-functions-ux/blob/fa150ffa944e93c6d08cc9798b558e7095febee3/server/src/stacks/2020-10-01/models/WebAppStackModel.ts
// tslint:disable: interface-name

export type WebAppStack = AppStack<WebAppRuntimes & JavaContainers, WebAppStackValue>;
export type WebAppStackValue = 'dotnet' | 'java' | 'javacontainers' | 'node' | 'php' | 'python' | 'ruby';

export interface WebAppRuntimes {
    linuxRuntimeSettings?: WebAppRuntimeSettings;
    windowsRuntimeSettings?: WebAppRuntimeSettings;
}

export interface WebAppRuntimeSettings extends CommonSettings {
    runtimeVersion: string;
    remoteDebuggingSupported: boolean;
    appInsightsSettings: AppInsightsSettings;
    gitHubActionSettings: GitHubActionSettings;
}

export interface JavaContainers {
    linuxContainerSettings?: LinuxJavaContainerSettings;
    windowsContainerSettings?: WindowsJavaContainerSettings;
}

export interface WindowsJavaContainerSettings extends CommonSettings {
    javaContainer: string;
    javaContainerVersion: string;
}

export interface LinuxJavaContainerSettings extends CommonSettings {
    java11Runtime?: string;
    java8Runtime?: string;
}
