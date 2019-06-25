/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ConfigurationTarget, QuickPickItem, Uri, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import * as constants from '../constants';
import { nonNullProp } from '../utils/nonNull';
import * as tasks from '../utils/tasks';
import * as workspaceUtil from '../utils/workspace';
import { IDeployWizardContext } from "./createWebApp/setAppWizardContextDefault";

export async function setDefaultsForDeployments(context: IDeployWizardContext): Promise<void> {
    const fsPath: string = nonNullProp(context, 'fsPath');
    const currentWorkspace: WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(fsPath);

    if (!currentWorkspace) {
        // if the workspace they are deploying is not opened, return and do nothing
        return;
    }
    const csProj = await workspaceUtil.findFilesByFileExtension(currentWorkspace.uri.fsPath, 'csproj');
    if (csProj.length > 0) {
        const csProjDoc = await workspace.openTextDocument(csProj[0]);
        const csProjJson = csProjDoc.getText();
        const targetFramework = 'TargetFramework';
        const regExString = new RegExp(`(?:<${targetFramework}.*>)(.*?)(?:<\/${targetFramework}*.>)`, 'ig'); //set ig flag for global search and case insensitive
        const testRE = regExString.exec(csProjJson);
        if (testRE) {
            // framworks are separated by a ";" if there are multiple listed
            const frameworks = testRE[1].split(';');
            let framework: string;
            if (frameworks.length > 1) {
                const frameworksQuickPick: QuickPickItem[] = frameworks.map((fw: string) => {
                    return {
                        label: fw
                    };
                });
                framework = (await ext.ui.showQuickPick(frameworksQuickPick, { placeHolder: 'Select a target framework for your .NET project' })).label;
            } else {
                framework = frameworks[0];
            }

            const subDeployPath = path.join('bin', 'Debug', framework, 'publish');
            const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix, currentWorkspace.uri);
            // tslint:disable-next-line: strict-boolean-expressions
            const deploySubpath: string | undefined = workspaceConfig.get(constants.configurationSettings.deploySubpath);
            if (deploySubpath) {
                const currentTargetFramework: string = deploySubpath.split(path.sep)[2];
                if (currentTargetFramework !== framework) {
                    // only update it if its different
                }
                await workspaceConfig.update(constants.configurationSettings.deploySubpath, subDeployPath, ConfigurationTarget.WorkspaceFolder);
            }
            await workspaceConfig.update(constants.configurationSettings.preDeployTask, 'publish');

            const publishTask: tasks.ITask[] = [{
                label: 'publish',
                command: 'dotnet publish',
                type: 'shell'
            }];

            tasks.updateTasks(currentWorkspace, publishTask);
        }
    }
}
