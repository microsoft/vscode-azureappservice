/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { localize } from './localize';

export const deploymentFileName: string = '.deployment';
export const deploymentFile: string = `[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true`;
export const none: string = 'None';
export const isWindows: boolean = /^win/.test(process.platform);

export enum configurationSettings {
    zipIgnorePattern = 'zipIgnorePattern',
    showBuildDuringDeployPrompt = 'showBuildDuringDeployPrompt',
    deploySubpath = 'deploySubpath',
    defaultWebAppToDeploy = 'defaultWebAppToDeploy',
    connections = 'connections',
    preDeployTask = 'preDeployTask'
}

export enum ScmType {
    None = 'None', // default scmType
    LocalGit = 'LocalGit',
    GitHub = 'GitHub'
}

export namespace AppServiceDialogResponses {
    export const deploy: MessageItem = { title: localize('deploy', 'Deploy') };
    export const viewOutput: MessageItem = { title: localize('viewOutput', 'View Output') };
}

export const envFileName: string = '.env';

export const detectorTimestampFormat: string = 'YYYY-MM-DDTHH:mm';

export const webProvider: string = 'Microsoft.Web';

export const webAppFilter = {
    type: 'microsoft.web/sites'
}
