/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { MessageItem, TaskDefinition } from 'vscode';
import { DialogResponses } from 'vscode-azureappservice/node_modules/vscode-azureextensionui';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { isPathEqual } from '../../utils/pathUtils';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "./IDeployWizardContext";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext): Promise<void> {
    const preDeployTaskSetting: string = 'preDeployTask';
    const showPreDeployWarningSetting: string = 'showPreDeployWarning';
    const workspaceFspath: string = context.workspace.uri.fsPath;

    // don't overwrite preDeploy or deploySubpath if it exists and respect configurePreDeployTasks setting
    if (!getWorkspaceSetting<boolean>(showPreDeployWarningSetting, workspaceFspath)
        || getWorkspaceSetting<string>(preDeployTaskSetting, workspaceFspath)
        || getWorkspaceSetting<string>(constants.configurationSettings.deploySubpath, workspaceFspath)) {
        return;
    }

    // if the user is deploying a different folder than the root, use this folder without setting up defaults
    if (!isPathEqual(context.deployFsPath, workspaceFspath)) {
        return;
    }

    const csprojFile: string | undefined = await tryGetCsprojFile(context, workspaceFspath);

    // if we found a .csproj file set the tasks and workspace settings
    if (csprojFile) {
        const notConfiguredForDeploy: string = `The selected project is not configured for deployment through VS Code. Add "${preDeployTaskSetting}" and "${constants.configurationSettings.deploySubpath}" settings?`;
        const dontShowAgainButton: MessageItem = { title: "No, and don't show again" };
        const input: MessageItem = await ext.ui.showWarningMessage(notConfiguredForDeploy, { modal: true }, DialogResponses.yes, dontShowAgainButton);
        if (input === dontShowAgainButton) {
            await updateWorkspaceSetting(showPreDeployWarningSetting, false, workspaceFspath);
        } else {
            // resolves to "."if it is not a subfolder
            const subfolder: string = path.dirname(path.relative(workspaceFspath, csprojFile));

            // always use posix for debug config
            const deploySubpath: string = path.posix.join(subfolder, 'bin', 'Release', 'publish');

            await updateWorkspaceSetting(preDeployTaskSetting, 'publish', workspaceFspath);
            await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, deploySubpath, workspaceFspath);

            // update the deployContext.deployFsPath with the .NET output path since getDeployFsPath is called prior to this
            context.deployFsPath = path.join(workspaceFspath, deploySubpath);

            // this will overwrite clean and publish tasks
            const existingTasks: tasks.ITask[] = tasks.getTasks(context.workspace);
            let dotnetTasks: tasks.ITask[] = getDotnetTasks(deploySubpath, subfolder);
            const filteredTasks: tasks.ITask[] = existingTasks.filter(t1 => {
                if (dotnetTasks.find(t2 => t2.label === t1.label)) {
                    return false;
                }
                return true;
            });

            dotnetTasks = filteredTasks.concat(dotnetTasks);

            tasks.updateTasks(context.workspace, dotnetTasks);
        }

    }
}

async function tryGetCsprojFile(context: IDeployWizardContext, projectPath: string): Promise<string | undefined> {
    let projectFiles: string[] = await checkFolderForCsproj(projectPath);
    // it's a common pattern to have the .csproj file in a subfolder so check one level deeper
    if (projectFiles.length === 0) {
        const subfolders: string[] = await fse.readdir(projectPath);
        await Promise.all(subfolders.map(async folder => {
            const filePath: string = path.join(projectPath, folder);
            // check its existence as this will check .vscode even if the project doesn't contain that folder
            if (fse.existsSync(filePath) && (await fse.stat(filePath)).isDirectory()) {
                projectFiles = projectFiles.concat(await checkFolderForCsproj(filePath));
            }
        }));
    }

    context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

    // if multiple csprojs were found, ignore them
    return projectFiles.length === 1 ? projectFiles[0] : undefined;

    async function checkFolderForCsproj(filePath: string): Promise<string[]> {
        const files: string[] = fse.readdirSync(filePath);
        const filePaths: string[] = files.map((f: string) => {
            return path.join(filePath, f);
        });

        return filePaths.filter((f: string) => /\.csproj$/i.test(f));
    }
}

function getDotnetTasks(deploySubpath: string, subfolder: string): TaskDefinition[] {
    // always use posix for debug config
    // tslint:disable-next-line: no-unsafe-any no-invalid-template-strings
    const cwd: string = path.posix.join('${workspaceFolder}', subfolder);
    return [
        {
            label: 'clean',
            command: 'dotnet clean',
            type: 'shell',
            problemMatcher: '$msCompile',
            options: {
                cwd
            }
        },
        {
            label: 'publish',
            command: `dotnet publish -o ${deploySubpath}`,
            type: 'shell',
            dependsOn: 'clean',
            problemMatcher: '$msCompile',
            options: {
                cwd
            }
        }
    ];
}