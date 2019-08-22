/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TaskDefinition, workspace, WorkspaceConfiguration, WorkspaceFolder } from "vscode";

const tasksKey: string = 'tasks';

export function updateTasks(folder: WorkspaceFolder, tasks: ITask[]): void {
    getTasksConfig(folder).update(tasksKey, tasks);
}

function getTasksConfig(folder: WorkspaceFolder): WorkspaceConfiguration {
    return workspace.getConfiguration(tasksKey, folder.uri);
}

export interface ITask extends TaskDefinition {
    label?: string;
    command?: string;
    options?: ITaskOptions;
}

export interface ITaskOptions {
    cwd?: string;
    env?: {
        [key: string]: string;
    };
}
