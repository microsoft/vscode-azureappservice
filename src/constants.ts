/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const deploymentFileName: string = '.deployment';
export const deploymentFile: string = `[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true`;

export enum ignoreFolderForDeployment {
    node = 'node_modules{,/**}'
}

export enum configurationSettings {
    zipIgnorePattern = 'zipIgnorePattern',
    neverPromptBuildDuringDeploy = 'neverPromptBuildDuringDeploy',
    showRemoteFiles = 'showRemoteFiles'
}
