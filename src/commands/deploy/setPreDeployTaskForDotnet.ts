/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "./IDeployWizardContext";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext, siteConfig: SiteConfig): Promise<void> {
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

    // assume that the csProj is in the root at first
    let csprojFile: string | undefined = await tryGetCsprojFile(context.workspace.uri.fsPath);

    // if we found a .csproj file set the tasks and workspace settings
    if (csprojFile) {
        await ext.ui.showWarningMessage('Configure this project for deployment with VS Code?', { modal: true }, { title: 'Yes' }, { title: 'Never show again' });
        // follow the publish output patterns, but leave out targetFramework
        // use the absolute path so the bits are created in the root, not the subpath
        const publishPath: string = path.posix.join('bin', 'Debug', 'publish');

        await updateWorkspaceSetting(preDeployTaskSetting, 'publish', context.workspace.uri.fsPath);
        await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, publishPath, workspaceFspath);

        // update the deployContext with the .NET output path since getDeployFsPath is called prior to this
        context.deployFsPath = path.join(context.workspace.uri.fsPath, publishPath);

        // set it as the relative path
        csprojFile = `${path.posix.normalize(path.relative(context.workspace.uri.fsPath, csprojFile))}`;
        const publishCommand: string = `dotnet publish ${csprojFile} -o ${publishPath}`;
        const publishTask: tasks.ITask[] = [{
            label: 'clean',
            command: `dotnet clean ${csprojFile}`,
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

    async function tryGetCsprojFile(projectPath: string): Promise<string | undefined> {
        let projectFiles: string[] = await checkFolderForCsproj(projectPath);
        // it's a common pattern to have the .csproj file in a subfolder so check one level deep
        if (projectFiles.length === 0) {
            for (const folder of fse.readdirSync(projectPath)) {
                const filePath: string = path.join(projectPath, folder);
                if (fse.existsSync(filePath) && (await fse.stat(filePath)).isDirectory()) {
                    projectFiles = projectFiles.concat(await checkFolderForCsproj(filePath));
                }
            }
        }

        context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

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
