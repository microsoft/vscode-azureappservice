/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { MessageItem, TaskDefinition } from 'vscode';
import { IDeployContext } from '@microsoft/vscode-azext-azureappservice';
import * as constants from '../../../constants';
import { localize } from "../../../localize";
import { updateWorkspaceSetting } from '../../../vsCodeConfig/settings';
import * as tasks from '../../../vsCodeConfig/tasks';

export async function setPreDeployTaskForMavenModule(context: IDeployContext, module: { path: string, artifactId: string, artifactFinalName: string }): Promise<void> {
    const workspaceFspath: string = context.workspaceFolder.uri.fsPath;
    const mavenPackageTaskName: string = `package:${module.artifactId}`;

    const notConfiguredForDeploy: string = localize('requiredConfig', 'Required configuration to deploy is missing from "{0}".', context.workspaceFolder.name);
    const addConfigButton: MessageItem = { title: localize('addConfig', "Add Config") };
    await context.ui.showWarningMessage(notConfiguredForDeploy, { modal: true }, addConfigButton);

    const relativeModulePath: string = path.relative(workspaceFspath, module.path);
    const deploySubpath: string = path.posix.join(relativeModulePath, 'target', module.artifactFinalName);

    await updateWorkspaceSetting(constants.configurationSettings.preDeployTask, mavenPackageTaskName, workspaceFspath);
    await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, deploySubpath, workspaceFspath);

    // update the deployContext.effectiveDeployPath with the maven artifact output path
    context.effectiveDeployFsPath = path.posix.join(workspaceFspath, deploySubpath);

    const currentVersion: string | undefined = tasks.getTasksVersion(context.workspaceFolder);
    if (!currentVersion) {
        await tasks.updateTasksVersion(context.workspaceFolder, tasks.tasksVersion);
    }

    const existingTasks: tasks.ITask[] = tasks.getTasks(context.workspaceFolder);
    let packageTask: tasks.ITask | undefined = existingTasks.find(t1 => t1.label === mavenPackageTaskName);
    if (!packageTask) {
        packageTask = generateMavenPackageTask(relativeModulePath);
        packageTask.label = mavenPackageTaskName;
        await tasks.updateTasks(context.workspaceFolder, existingTasks.concat([packageTask]));
    }
}

function generateMavenPackageTask(relativeModulePath: string): TaskDefinition {
    // always use posix for debug config because it's committed to source control and works on all OS's
    const cwd: string = path.posix.join('${workspaceFolder}', relativeModulePath);

    return {
        command: 'mvn',
        type: "shell",
        group: "build",
        args: ["clean", "package"],
        options: { cwd }
    };
}
