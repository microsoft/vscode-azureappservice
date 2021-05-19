/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import {TaskDefinition} from 'vscode';
import {IDeployContext} from 'vscode-azureappservice';
import * as constants from '../../constants';
import {javaUtils} from "../../utils/javaUtils";
import {getWorkspaceSetting, updateWorkspaceSetting} from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';

export async function setPreDeployTaskForMavenModule(context: IDeployContext): Promise<string | null> {
    const preDeployTaskKey: string = 'preDeployTask';
    const workspaceFspath: string = context.workspaceFolder.uri.fsPath;

    if (!javaUtils.isMavenModule(context.effectiveDeployFsPath)) {
        return null;
    }

    const artifact = javaUtils.getMavenArtifact(path.posix.join(context.effectiveDeployFsPath, 'pom.xml'));
    if (getWorkspaceSetting<string>(preDeployTaskKey, workspaceFspath)) {
        return artifact.file;
    }

    const existingTasks: tasks.ITask[] = tasks.getTasks(context.workspaceFolder);
    let packageTask: tasks.ITask | undefined = existingTasks.find(t1 => t1.label === constants.mavenPackageTaskName);
    // if the "package" task exists and it doesn't dependOn a task, have it depend on clean
    if (!packageTask) {
        packageTask = await generateMavenPackageTask(context.effectiveDeployFsPath);
        await tasks.updateTasks(context.workspaceFolder, existingTasks.concat([packageTask]));
    }

    const currentVersion: string | undefined = tasks.getTasksVersion(context.workspaceFolder);
    if (!currentVersion) {
        await tasks.updateTasksVersion(context.workspaceFolder, tasks.tasksVersion);
    }

    await updateWorkspaceSetting(preDeployTaskKey, packageTask.label, workspaceFspath);
    return artifact.file;
}

async function generateMavenPackageTask(modulePath: string): Promise<TaskDefinition> {
    const mvnWrapperName = constants.isWindows ? "./mvnw.cmd" : "./mvnw";
    const mvnWrapper = await javaUtils.getLocalMavenWrapper(modulePath);
    const cmd = mvnWrapper ? mvnWrapperName : 'mvn';
    const cwd = mvnWrapper ? path.dirname(mvnWrapper) : modulePath;
    const relativeModulePath: string = path.dirname(path.relative(cwd, modulePath));
    const pomPath: string = path.posix.join(relativeModulePath, 'pom.xml');

    return {
        label: constants.mavenPackageTaskName,
        command: cmd,
        type: "shell",
        group: "build",
        args: ["clean", "package", "-f", pomPath],
        options: { cwd },
        presentation: {
            echo: true,
            reveal: "always",
            focus: false,
            panel: "shared",
            showReuseMessage: true,
            clear: false
        },
        problemMatcher: "$msCompile",
    };
}