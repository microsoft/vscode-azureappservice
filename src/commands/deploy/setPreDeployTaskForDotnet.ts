/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { QuickPickItem, TextDocument, workspace, WorkspaceFolder } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import * as constants from '../../constants';
import { nonNullProp } from '../../utils/nonNull';
import * as workspaceUtil from '../../utils/workspace';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "../createWebApp/setAppWizardContextDefault";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext): Promise<void> {
    const fsPath: string = nonNullProp(context, 'fsPath');
    const currentWorkspace: WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(fsPath);
    // follow the publish output patterns, but leaveout tfw
    const dotnetOutputPath: string = path.join('bin', 'Debug', 'publish');

    // tslint:disable-next-line: strict-boolean-expressions
    if (!currentWorkspace || !getWorkspaceSetting('configurePreDeployTasks', currentWorkspace.uri.fsPath)) {
        // if the workspace being deployed is not opened, return and do nothing
        return;
    }

    const csProj = await workspaceUtil.findFilesByFileExtension(currentWorkspace.uri.fsPath, 'csproj');
    if (csProj.length > 0) {
        // if a publish task is already defined, then assume that we don't need this logic
        if (getWorkspaceSetting(constants.configurationSettings.preDeployTask, currentWorkspace.uri.fsPath) !== 'publish') {
            // if this doesn't have the publish preDeployTask, configure for .NET depoyment
            const csProjDoc: TextDocument = await workspace.openTextDocument(csProj[0]);
            const csProjJson: string = csProjDoc.getText();

            const tfw: string = 'TargetFrameworks';
            const tfwRegExp: RegExp = new RegExp(`(?:<${tfw}.*>)(.*?)(?:<\/${tfw}*.>)`, 'ig'); //set ig flag for global search and case insensitive
            const tfwMatches: string[] | null = tfwRegExp.exec(csProjJson);
            let framework: string | undefined;

            if (tfwMatches) {
                // framworks are separated by a ";" if there are multiple listed
                const frameworks: string[] = tfwMatches[1].split(';');

                if (frameworks.length > 1) {
                    const frameworksQuickPick: QuickPickItem[] = frameworks.map((fw: string) => {
                        return {
                            label: fw
                        };
                    });
                    framework = (await ext.ui.showQuickPick(frameworksQuickPick, { placeHolder: 'Select a target framework for your .NET project' })).label;
                } else {
                    // <TargetFrameworks> is used for indicating there are multiple, but if there is only one, use that
                    framework = frameworks[0];
                }
            }

            await updateWorkspaceSetting(constants.configurationSettings.preDeployTask, 'publish', currentWorkspace.uri.fsPath);
            await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, dotnetOutputPath, currentWorkspace.uri.fsPath);

            const publishCommand: string = `dotnet publish -o ${dotnetOutputPath}${framework ? ` -f ${framework}` : ''}`;
            const publishTask: tasks.ITask[] = [{
                label: 'clean',
                command: 'dotnet clean',
                type: 'shell'
            },
            {
                label: 'publish',
                command: publishCommand,
                type: 'shell',
                dependsOn: 'clean'
            }];

            tasks.updateTasks(currentWorkspace, publishTask);
        }
    }
}
