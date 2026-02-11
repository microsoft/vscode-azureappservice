/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Creates a mock vscode.ExtensionContext for testing purposes.
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
    const tempDir = os.tmpdir();
    const extensionPath = path.join(tempDir, 'vscode-azureappservice-test');

    const subscriptions: vscode.Disposable[] = [];

    const globalState = createMockMementoWithSync();
    const workspaceState = createMockMemento();
    const secrets = createMockSecretStorage();

    return {
        subscriptions,
        extensionPath,
        extensionUri: vscode.Uri.file(extensionPath),
        globalStoragePath: path.join(tempDir, 'globalStorage'),
        globalStorageUri: vscode.Uri.file(path.join(tempDir, 'globalStorage')),
        logPath: path.join(tempDir, 'logs'),
        logUri: vscode.Uri.file(path.join(tempDir, 'logs')),
        storagePath: path.join(tempDir, 'storage'),
        storageUri: vscode.Uri.file(path.join(tempDir, 'storage')),
        globalState,
        workspaceState,
        secrets,
        extensionMode: vscode.ExtensionMode.Test,
        extension: {
            id: 'ms-azuretools.vscode-azureappservice',
            extensionUri: vscode.Uri.file(extensionPath),
            extensionPath,
            isActive: true,
            packageJSON: {
                name: 'vscode-azureappservice',
                displayName: 'Azure App Service',
                version: '0.0.0-test',
                publisher: 'ms-azuretools',
                aiKey: '0c6ae279ed8443289764825290e4f9e2-1a736e7c-1324-4338-be46-fc2a58ae4d14-7255',
            },
            extensionKind: vscode.ExtensionKind.Workspace,
            exports: undefined,
            activate: () => Promise.resolve(),
        },
        environmentVariableCollection: createMockEnvironmentVariableCollection(),
        asAbsolutePath: (relativePath: string) => path.join(extensionPath, relativePath),
        languageModelAccessInformation: {
            onDidChange: new vscode.EventEmitter<void>().event,
            canSendRequest: () => undefined,
        },
    };
}

function createMockMemento(): vscode.Memento {
    const storage = new Map<string, unknown>();

    return {
        keys: () => [...storage.keys()],
        get<T>(key: string, defaultValue?: T): T | undefined {
            return storage.has(key) ? storage.get(key) as T : defaultValue;
        },
        update(key: string, value: unknown): Thenable<void> {
            storage.set(key, value);
            return Promise.resolve();
        },
    };
}

function createMockMementoWithSync(): vscode.Memento & { setKeysForSync(keys: readonly string[]): void } {
    const memento = createMockMemento();

    return {
        ...memento,
        setKeysForSync(_keys: readonly string[]): void {
            // no-op for tests
        },
    };
}

function createMockSecretStorage(): vscode.SecretStorage {
    const storage = new Map<string, string>();
    const onDidChangeEmitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();

    return {
        get(key: string): Thenable<string | undefined> {
            return Promise.resolve(storage.get(key));
        },
        store(key: string, value: string): Thenable<void> {
            storage.set(key, value);
            onDidChangeEmitter.fire({ key });
            return Promise.resolve();
        },
        delete(key: string): Thenable<void> {
            storage.delete(key);
            onDidChangeEmitter.fire({ key });
            return Promise.resolve();
        },
        onDidChange: onDidChangeEmitter.event,
    };
}

function createMockEnvironmentVariableCollection(): vscode.GlobalEnvironmentVariableCollection {
    const variables = new Map<string, vscode.EnvironmentVariableMutator>();
    const defaultOptions: vscode.EnvironmentVariableMutatorOptions = {
        applyAtProcessCreation: true,
        applyAtShellIntegration: false,
    };

    const collection: vscode.GlobalEnvironmentVariableCollection = {
        persistent: true,
        description: undefined,
        replace(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
            variables.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Replace, options: options ?? defaultOptions });
        },
        append(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
            variables.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Append, options: options ?? defaultOptions });
        },
        prepend(variable: string, value: string, options?: vscode.EnvironmentVariableMutatorOptions): void {
            variables.set(variable, { value, type: vscode.EnvironmentVariableMutatorType.Prepend, options: options ?? defaultOptions });
        },
        get(variable: string): vscode.EnvironmentVariableMutator | undefined {
            return variables.get(variable);
        },
        forEach(callback: (variable: string, mutator: vscode.EnvironmentVariableMutator, collection: vscode.EnvironmentVariableCollection) => void): void {
            variables.forEach((mutator, variable) => callback(variable, mutator, collection));
        },
        delete(variable: string): void {
            variables.delete(variable);
        },
        clear(): void {
            variables.clear();
        },
        getScoped(_scope: vscode.EnvironmentVariableScope): vscode.EnvironmentVariableCollection {
            // Return the same collection for scoped requests in tests
            return collection;
        },
        [Symbol.iterator]: function* () {
            for (const [variable, mutator] of variables) {
                yield [variable, mutator] as [string, vscode.EnvironmentVariableMutator];
            }
        },
    };

    return collection;
}
