/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { window } from 'vscode';
import { DialogResponses, IActionContext } from 'vscode-azureextensionui';
import * as constants from '../../constants';
import { cpUtils } from '../../utils/cpUtils';
import { openUrl } from '../../utils/openUrl';
import * as workspaceUtil from '../../utils/workspace';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "../createWebApp/setAppWizardContextDefault";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext): Promise<void> {
    await validateDotnetInstalled(context);
    // follow the publish output patterns, but leave out tfw
    const dotnetOutputPath: string = path.join('bin', 'Debug', 'publish');

    if (!getWorkspaceSetting<boolean>('configurePreDeployTasks', context.workspace.uri.fsPath)) {
        return;
    }

    const csProj = await workspaceUtil.findFilesByFileExtension(context.workspace.uri.fsPath, 'csproj');
    if (csProj.length > 0) {
        // if a publish task is already defined, then assume that we don't need this logic
        if (!getWorkspaceSetting<string>(constants.configurationSettings.preDeployTask, context.workspace.uri.fsPath)) {
            // if this doesn't have the publish preDeployTask, configure for .NET depoyment

            await updateWorkspaceSetting(constants.configurationSettings.preDeployTask, 'publish', context.workspace.uri.fsPath);
            await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, dotnetOutputPath, context.workspace.uri.fsPath);

            const publishCommand: string = `dotnet publish -o ${dotnetOutputPath}`;
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

            tasks.updateTasks(context.workspace, publishTask);
        }
    }
}

async function isDotnetInstalled(): Promise<boolean> {
    try {
        await cpUtils.executeCommand(undefined, undefined, 'dotnet', '--version');
        return true;
    } catch (error) {
        return false;
    }
}

async function validateDotnetInstalled(context: IActionContext): Promise<void> {
    if (!await isDotnetInstalled()) {
        const message: string = 'You must have the .NET CLI installed to perform this operation.';

        if (!context.errorHandling.suppressDisplay) {
            // don't wait
            window.showErrorMessage(message, DialogResponses.learnMore).then(async (result) => {
                if (result === DialogResponses.learnMore) {
                    await openUrl('https://aka.ms/AA4ac70');
                }
            });
            context.errorHandling.suppressDisplay = true;
        }

        throw new Error(message);
    }
}
