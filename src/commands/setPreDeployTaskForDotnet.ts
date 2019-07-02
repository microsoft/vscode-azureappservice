/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { QuickPickItem, TextDocument, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import * as constants from '../constants';
import { nonNullProp } from '../utils/nonNull';
import * as tasks from '../utils/tasks';
import * as workspaceUtil from '../utils/workspace';
import { IDeployWizardContext } from "./createWebApp/setAppWizardContextDefault";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext): Promise<void> {
    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(constants.extensionPrefix);
    if (workspaceConfig.get(constants.configurationSettings.preDeployTask) === 'publish') {
        // if this already has the publish preDeployTask, it should already be configured for .NET depoyments
        return;
    }

    const fsPath: string = nonNullProp(context, 'fsPath');
    const currentWorkspace: WorkspaceFolder | undefined = workspaceUtil.getContainingWorkspace(fsPath);
    const dotnetOutputPath: string = 'publish';

    if (!currentWorkspace) {
        // if the workspace they are deploying is not opened, return and do nothing
        return;
    }

    const csProj = await workspaceUtil.findFilesByFileExtension(currentWorkspace.uri.fsPath, 'csproj');
    if (csProj.length > 0) {
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

        await workspaceConfig.update(constants.configurationSettings.preDeployTask, 'publish');

        const publishCommand: string = `dotnet publish -o ${dotnetOutputPath}${framework ? ` -f ${framework}` : ''}`;
        const publishTask: tasks.ITask[] = [{
            label: 'publish',
            command: publishCommand,
            type: 'shell'
        }];

        context.fsPath = path.join(currentWorkspace.uri.fsPath, dotnetOutputPath);
        tasks.updateTasks(currentWorkspace, publishTask);
    }
}
