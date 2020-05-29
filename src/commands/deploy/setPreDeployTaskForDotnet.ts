/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { MessageItem, TaskDefinition } from 'vscode';
import * as constants from '../../constants';
import { ext } from '../../extensionVariables';
import { isPathEqual } from '../../utils/pathUtils';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployContext } from "./IDeployContext";

const cleanId: string = 'clean';
const publishId: string = 'publish-release';

export async function setPreDeployTaskForDotnet(context: IDeployContext): Promise<void> {
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
    if (!isPathEqual(context.originalDeployFsPath, workspaceFspath)) {
        return;
    }

    // if the user has a ".deployment" file - assume they've already configured their project's deploy settings
    if (await fse.pathExists(path.join(context.effectiveDeployFsPath, constants.deploymentFileName))) {
        return;
    }

    const csprojFile: string | undefined = await tryGetCsprojFile(context, workspaceFspath);

    // if we found a .csproj file set the tasks and workspace settings
    if (csprojFile) {
        const targetFramework: string | undefined = await tryGetTargetFramework(csprojFile);
        context.telemetry.properties.tfw = targetFramework ? targetFramework : 'N/A';

        if (!targetFramework) {
            // if the target framework cannot be found, don't try to set defaults
            return;
        }

        const notConfiguredForDeploy: string = `Required configuration to deploy is missing from "${context.workspace.name}".`;
        const addConfigButton: MessageItem = { title: "Add Config" };
        await ext.ui.showWarningMessage(notConfiguredForDeploy, { modal: true }, addConfigButton);

        // resolves to "."if it is not a subfolder
        const subfolder: string = path.dirname(path.relative(workspaceFspath, csprojFile));

        // always use posix for debug config because it's committed to source control and works on all OS's
        const deploySubpath: string = path.posix.join(subfolder, 'bin', 'Release', targetFramework, 'publish');

        await updateWorkspaceSetting(preDeployTaskSetting, publishId, workspaceFspath);
        await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, deploySubpath, workspaceFspath);

        // update the deployContext.effectiveDeployPath with the .NET output path since getDeployFsPath is called prior to this
        context.effectiveDeployFsPath = path.join(workspaceFspath, deploySubpath);

        const existingTasks: tasks.ITask[] = tasks.getTasks(context.workspace);
        const publishTask: tasks.ITask | undefined = existingTasks.find(t1 => {
            return t1.label === publishId;
        });

        if (publishTask) {
            // if the "publish" task exists and it doesn't dependOn a task, have it depend on clean
            // tslint:disable-next-line: strict-boolean-expressions
            publishTask.dependsOn = publishTask.dependsOn || cleanId;

        }

        // do not overwrite any dotnet tasks the user already defined
        let newTasks: tasks.ITask[] = generateDotnetTasks(subfolder);
        newTasks = newTasks.filter(t1 => !existingTasks.find(t2 => {
            return t1.label === t2.label;
        }));

        const currentVersion: string | undefined = tasks.getTasksVersion(context.workspace);
        if (!currentVersion) {
            tasks.updateTasksVersion(context.workspace, tasks.tasksVersion);
        }

        tasks.updateTasks(context.workspace, existingTasks.concat(newTasks));
    }
}

async function tryGetCsprojFile(context: IDeployContext, projectPath: string): Promise<string | undefined> {
    const projectFiles: string[] = await checkFolderForCsproj(projectPath);
    // it's a common pattern to have the .csproj file in a subfolder so check one level deeper
    if (projectFiles.length === 0) {
        const subfolders: string[] = await fse.readdir(projectPath);
        await Promise.all(subfolders.map(async folder => {
            const filePath: string = path.join(projectPath, folder);
            // check its existence as this will check .vscode even if the project doesn't contain that folder
            if (await fse.pathExists(filePath) && (await fse.stat(filePath)).isDirectory()) {
                projectFiles.push(...await checkFolderForCsproj(filePath));
                context.telemetry.properties.csprojInSubfolder = 'true';
            }
        }));
    }

    context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

    // if multiple csprojs were found, ignore them
    return projectFiles.length === 1 ? projectFiles[0] : undefined;
}

async function checkFolderForCsproj(filePath: string): Promise<string[]> {
    const files: string[] = await fse.readdir(filePath);
    const filePaths: string[] = files.map((f: string) => {
        return path.join(filePath, f);
    });

    return filePaths.filter((f: string) => /\.csproj$/i.test(f));
}

async function tryGetTargetFramework(projFilePath: string): Promise<string | undefined> {
    const projContents: string = (await fse.readFile(projFilePath)).toString();
    const matches: RegExpMatchArray | null = projContents.match(/<TargetFramework>(.*)<\/TargetFramework>/);
    return matches === null ? undefined : matches[1];
}

function generateDotnetTasks(subfolder: string): TaskDefinition[] {
    // always use posix for debug config because it's committed to source control and works on all OS's
    // tslint:disable-next-line: no-unsafe-any no-invalid-template-strings
    const cwd: string = path.posix.join('${workspaceFolder}', subfolder);

    const cleanTask: TaskDefinition = {
        label: cleanId,
        command: "dotnet",
        type: "process",
        args: [
            'clean',
            cwd,
            "/property:GenerateFullPaths=true",
            "/consoleloggerparameters:NoSummary"
        ],
        problemMatcher: "$msCompile"
    };

    const publishTask: TaskDefinition = {
        label: publishId,
        command: "dotnet",
        type: "process",
        args: [
            'publish',
            cwd,
            '--configuration',
            'Release',
            "/property:GenerateFullPaths=true",
            "/consoleloggerparameters:NoSummary"
        ],
        problemMatcher: "$msCompile",
        dependsOn: cleanId
    };

    return [cleanTask, publishTask];
}
