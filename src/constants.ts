/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const deploymentFileName: string = '.deployment';
export const deploymentFile: string = `[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true`;

export const extensionPrefix: string = 'appService';
export enum runtimes {
    node = 'node',
    php = 'php',
    dotnetcore = 'dotnetcore',
    ruby = 'ruby',
    tomcat = 'tomcat'
}

export function getIgnoredFoldersForDeployment(runtime: string): string[] {
    switch (runtime) {
        case runtimes.node:
            return ['node_modules{,/**}'];
        default:
            return [];
    }
}

export enum configurationSettings {
    zipIgnorePattern = 'zipIgnorePattern',
    showBuildDuringDeployPrompt = 'showBuildDuringDeployPrompt',
    deploySubpath = 'deploySubpath',
    advancedCreation = 'advancedCreation',
    deploymentConfigurations = 'deploymentConfigurations'
}
