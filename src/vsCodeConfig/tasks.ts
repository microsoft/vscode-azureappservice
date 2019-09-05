/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TaskDefinition, workspace, WorkspaceConfiguration, WorkspaceFolder } from "vscode";

const tasksKey: string = 'tasks';

export function getTasks(folder: WorkspaceFolder): ITask[] {
    // tslint:disable-next-line: strict-boolean-expressions
    return getTasksConfig(folder).get<ITask[]>(tasksKey) || [];
}

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

export function insertNewTasks(existingTasks: ITask[] | undefined, newTasks: ITask[]): ITask[] {
    // tslint:disable-next-line: strict-boolean-expressions
    existingTasks = existingTasks || [];
    // Remove tasks that match the ones we're about to add
    existingTasks = existingTasks.filter(t1 => !newTasks.find(t2 => {
        if (t1.type === t2.type) {
            switch (t1.type) {
                case 'shell':
                case 'process':
                    return t1.label === t2.label && t1.identifier === t2.identifier;
                default:
                    // Not worth throwing an error for unrecognized task type
                    // Worst case the user has an extra task in their tasks.json
                    return false;
            }
        } else {
            return false;
        }
    }));
    existingTasks.push(...newTasks);
    return existingTasks;
}
