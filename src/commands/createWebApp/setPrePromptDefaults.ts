/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IDeployContext } from '@microsoft/vscode-azext-azureappservice';
import { LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { type ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import * as path from 'path';
import { type WorkspaceFolder } from 'vscode';
import { javaUtils } from '../../utils/javaUtils';
import { findFilesByFileExtension, getSingleRootWorkspace } from '../../utils/workspace';
import { type IWebAppWizardContext } from './IWebAppWizardContext';

export async function setPrePromptDefaults(wizardContext: IWebAppWizardContext & Partial<IDeployContext> & Partial<ICreateChildImplContext>): Promise<void> {
    // if the user entered through "Deploy", we'll have a project to base our recommendations on
    // otherwise, look at their current workspace and only suggest if one workspace is opened
    const workspaceForRecommendation: WorkspaceFolder | undefined = getSingleRootWorkspace(wizardContext);

    if (workspaceForRecommendation) {
        const fsPath: string = workspaceForRecommendation.uri.fsPath;

        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.recommendedSiteRuntime = ['node'];
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            wizardContext.recommendedSiteRuntime = ['python'];
        } else if ((await findFilesByFileExtension(workspaceForRecommendation.uri.fsPath, 'csproj')).length > 0) {
            wizardContext.recommendedSiteRuntime = ['dotnet'];
        } else if (await javaUtils.isJavaProject(fsPath)) {
            wizardContext.recommendedSiteRuntime = ['java'];

            // to avoid 'Requested features are not supported in region' error
            await LocationListStep.setLocation(wizardContext, 'weseteurope');
        }
    }

    if (!wizardContext.advancedCreation) {
        if (!LocationListStep.hasLocation(wizardContext)) {
            await LocationListStep.setLocation(wizardContext, 'centralus');
        }
    }
}
