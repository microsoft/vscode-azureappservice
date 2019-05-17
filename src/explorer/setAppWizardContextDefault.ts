/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace, WorkspaceConfiguration } from 'vscode';
import { IAppServiceWizardContext, LinuxRuntimes, WebsiteOS } from 'vscode-azureappservice';
import { LocationListStep } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix } from '../constants';
import { javaUtils } from '../utils/javaUtils';

export async function setAppWizardContextDefault(wizardContext: IAppServiceWizardContext): Promise<void> {
    const isJavaProject: boolean = await javaUtils.isJavaProject();

    if (isJavaProject) {
        wizardContext.recommendedSiteRuntime = [
            LinuxRuntimes.java,
            LinuxRuntimes.tomcat,
            LinuxRuntimes.wildfly
        ];

        // considering high resource requirement for Java applications, a higher plan sku is set here
        wizardContext.newPlanSku = { name: 'P1v2', tier: 'PremiumV2', size: 'P1v2', family: 'P', capacity: 1 };
        // to avoid 'Requested features are not supported in region' error
        await LocationListStep.setLocation(wizardContext, 'weseteurope');
    }

    // only detect if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.recommendedSiteRuntime = [LinuxRuntimes.node];
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            wizardContext.recommendedSiteRuntime = [LinuxRuntimes.python];
        }
    }

    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
    const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
    if (!advancedCreation) {
        if (!wizardContext.location) {
            await LocationListStep.setLocation(wizardContext, 'centralus');
        }

        if (!wizardContext.newPlanSku) {
            // don't overwrite the planSku if it is already set
            wizardContext.newPlanSku = { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 };
        }

        // if we are recommending a runtime, then it is either Nodejs, Python, or Java which all use Linux
        if (wizardContext.recommendedSiteRuntime) {
            wizardContext.newSiteOS = WebsiteOS.linux;
        } else {
            await workspace.findFiles('*.csproj').then((files: Uri[]) => {
                if (files.length > 0) {
                    wizardContext.newSiteOS = WebsiteOS.windows;
                }
            });
        }
    }
}
