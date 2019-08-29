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
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "./IDeployWizardContext";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext): Promise<void> {
    const preDeployTaskSetting: string = 'preDeployTask';
    const configurePreDeployTasksSetting: string = 'configurePreDeployTasks';
    const workspaceFspath: string = context.workspace.uri.fsPath;

    // don't overwrite preDeploy or deploySubpath if it exists and respect configurePreDeployTasks setting
    if (!getWorkspaceSetting<boolean>(configurePreDeployTasksSetting, context.workspace.uri.fsPath)
        || getWorkspaceSetting<string>(preDeployTaskSetting, context.workspace.uri.fsPath)
        || getWorkspaceSetting<string>(constants.configurationSettings.deploySubpath, workspaceFspath)) {
        return;
    }

    // if the user is deploying a different folder than the root, use this folder without setting up defaults
    if (context.deployFsPath !== context.workspace.uri.fsPath) {
        return;
    }

    const csprojFile: string | undefined = await tryGetCsprojFile(context.workspace.uri.fsPath);

    // if we found a .csproj file set the tasks and workspace settings
    if (csprojFile) {
        const notConfiguredForDeploy: string = `The selected app is not configured for deployment through VS Code. Add "${preDeployTaskSetting}" and "${constants.configurationSettings.deploySubpath}" settings?`;
        const dontShowAgainButton: MessageItem = { title: "No, and don't show again" };
        const input: MessageItem = await ext.ui.showWarningMessage(notConfiguredForDeploy, { modal: true }, DialogResponses.yes, dontShowAgainButton);
        if (input === dontShowAgainButton) {
            await updateWorkspaceSetting(configurePreDeployTasksSetting, false, context.workspace.uri.fsPath);
        } else {
            // resolves to "."if it is not a subfolder
            const subfolder: string = path.dirname(path.relative(context.workspace.uri.fsPath, csprojFile));
            const deploySubpath: string = path.posix.join(subfolder, 'bin', 'Release', 'publish');

            await updateWorkspaceSetting(preDeployTaskSetting, 'publish', context.workspace.uri.fsPath);
            await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, deploySubpath, workspaceFspath);

            // update the deployContext.deployFsPath with the .NET output path since getDeployFsPath is called prior to this
            // purposely not using posix since this is happening at runtime
            context.deployFsPath = path.join(context.workspace.uri.fsPath, deploySubpath);

            const defaultTasks = getTasks(deploySubpath, subfolder);
            tasks.updateTasks(context.workspace, defaultTasks);
        }

    }

    async function tryGetCsprojFile(projectPath: string): Promise<string | undefined> {
        let projectFiles: string[] = await checkFolderForCsproj(projectPath);
        // it's a common pattern to have the .csproj file in a subfolder so check one level deeper
        if (projectFiles.length === 0) {
            for (const folder of fse.readdirSync(projectPath)) {
                const filePath: string = path.join(projectPath, folder);
                if (fse.existsSync(filePath) && (await fse.stat(filePath)).isDirectory()) {
                    projectFiles = projectFiles.concat(await checkFolderForCsproj(filePath));
                }
            }
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
}

function getTasks(deploySubpath: string, subfolder: string): TaskDefinition[] {
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
