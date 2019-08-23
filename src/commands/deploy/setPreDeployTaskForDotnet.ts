/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import * as constants from '../../constants';
import { findFilesByFileExtension, mapFilesToQuickPickItems } from '../../utils/workspace';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "./IDeployWizardContext";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext, siteConfig: SiteConfig): Promise<void> {
    const preDeployTaskSetting: string = 'preDeployTask';
    const configurePreDeployTasksSetting: string = 'configurePreDeployTasks';

    // don't overwrite preDeploy task if it exists
    if (!getWorkspaceSetting<boolean>(configurePreDeployTasksSetting, context.workspace.uri.fsPath) ||
        getWorkspaceSetting<string>(preDeployTaskSetting, context.workspace.uri.fsPath)) {
        return;
    }

    // assume that the csProj is in the root at first
    let csProjFsPath: string = context.workspace.uri.fsPath;

    const csprojFile: string | undefined = await tryGetCsprojFile(csProjFsPath);

    if (csprojFile) {
        csProjFsPath = path.dirname(csProjFsPath);
    }

    // if we found a .csproj file or we know the runtime is .NET, set the tasks and workspace settings
    // assumes the .csproj file is in the root if one was not found
    if (csprojFile || (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().includes('dotnet'))) {
        // follow the publish output patterns, but leave out targetFramework
        // use the absolute path so the bits are created in the root, not the subpath
        const dotnetOutputPath: string = path.join(csProjFsPath, 'bin', 'Debug', 'publish');

        await updateWorkspaceSetting(preDeployTaskSetting, 'publish', context.workspace.uri.fsPath);
        await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, dotnetOutputPath, context.workspace.uri.fsPath);

        const publishCommand: string = `dotnet publish ${csProjFsPath} -o ${dotnetOutputPath}`;
        const publishTask: tasks.ITask[] = [{
            label: 'clean',
            command: `dotnet clean ${csProjFsPath}`,
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
        const projectFiles: string[] = await checkFolderForCsproj(projectPath);
        // it's a common pattern to have the .csproj file in a subfolder
        if (projectFiles.length === 0) {
            for (const folder of await fse.readdir(projectPath)) {
                if ((await fse.stat(folder)).isDirectory()) {
                    projectFiles.concat(await checkFolderForCsproj(folder));
                }
            }
        }

        context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

        return projectFiles.length === 1 ? projectFiles[0] : undefined;

        async function checkFolderForCsproj(filePath: string): Promise<string[]> {
            const files: string[] = await fse.readdir(filePath);
            return files.filter((f: string) => /\.csproj$/i.test(f));
        }
    }

}
