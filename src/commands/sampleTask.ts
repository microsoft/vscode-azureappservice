'use strict';
import * as vscode from 'vscode';

export function activate(): void {
    const type = "exampleProvider";
    vscode.tasks.registerTaskProvider(type, {
        provideTasks(_token?: vscode.CancellationToken) {
            const execution = new vscode.ShellExecution("echo \"Hello World\"");
            const problemMatchers = ["$myProblemMatcher"];
            return [
                new vscode.Task({ type: type }, vscode.TaskScope.Workspace,
                    "Build", "myExtension", execution, problemMatchers)
            ];
        },
        resolveTask(task: vscode.Task, _token?: vscode.CancellationToken) {
            return task;
        }
    });
}
