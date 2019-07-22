/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, workspace, WorkspaceFolder } from 'vscode';
import { IAppServiceWizardContext, LinuxRuntimes, WebsiteOS } from 'vscode-azureappservice';
import { IActionContext, LocationListStep } from 'vscode-azureextensionui';
import { configurationSettings } from '../../constants';
import { getRecommendedSiteRuntime } from '../../getRecommendedSiteRuntime';
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';

export interface IDeployWizardContext extends IActionContext {
    workspace: WorkspaceFolder;
    siteRuntime: LinuxRuntimes[] | undefined;
    deployedWithConfigs?: boolean;
    configurationTarget?: ConfigurationTarget;
}

export async function setAppWizardContextDefault(wizardContext: IAppServiceWizardContext, deployedWorkspace?: WorkspaceFolder): Promise<void> {
    // if the user entered through "Deploy", we'll have a project to base our recommendations on
    // otherwise, look at their current workspace and only suggest if one workspace is opened
    const workspaceForRecommendation: WorkspaceFolder | undefined = deployedWorkspace ?
        deployedWorkspace : workspace.workspaceFolders && workspace.workspaceFolders.length === 1 ?
            workspace.workspaceFolders[0] : undefined;

    let fsPath: string | undefined;

    if (workspaceForRecommendation) {
        fsPath = workspaceForRecommendation.uri.fsPath;
        wizardContext.recommendedSiteRuntime = await getRecommendedSiteRuntime(workspaceForRecommendation);
    }

    const advancedCreation: boolean | undefined = getWorkspaceSetting(configurationSettings.advancedCreation, fsPath);

    if (wizardContext.recommendedSiteRuntime && wizardContext.recommendedSiteRuntime.indexOf(LinuxRuntimes.java) > -1) {
        // considering high resource requirement for Java applications, a higher plan sku is set here
        wizardContext.newPlanSku = { name: 'P1v2', tier: 'PremiumV2', size: 'P1v2', family: 'P', capacity: 1 };
        // to avoid 'Requested features are not supported in region' error
        await LocationListStep.setLocation(wizardContext, 'weseteurope');
    }

    if (!advancedCreation) {
        if (!wizardContext.location) {
            await LocationListStep.setLocation(wizardContext, 'centralus');
        }

        if (!wizardContext.newPlanSku) {
            // don't overwrite the planSku if it is already set
            wizardContext.newPlanSku = { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 };
        }

        // if we are recommending a runtime, then it is either Nodejs, Python, .NET, or Java which all default to Linux
        if (wizardContext.recommendedSiteRuntime) {
            wizardContext.newSiteOS = WebsiteOS.linux;
        }
    }
}
