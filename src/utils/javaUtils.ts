/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "azure-arm-website/lib/models";
import * as fse from 'fs-extra';
import * as path from 'path';
import { workspace } from "vscode";
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem, UserCancelledError } from 'vscode-azureextensionui';
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { ext } from '../extensionVariables';

export namespace javaUtils {
    const DEFAULT_PORT: string = '8080';
    const PORT_KEY: string = 'PORT';

    export function isJavaWebContainerRuntime(runtime: string | undefined): boolean {
        return !!runtime && /^(tomcat|wildfly)/i.test(runtime);
    }

    export function isJavaSERuntime(runtime: string | undefined): boolean {
        return !!runtime && /^java/i.test(runtime);
    }

    export function isJavaRuntime(runtime: string | undefined): boolean {
        return isJavaWebContainerRuntime(runtime) || isJavaSERuntime(runtime);
    }

    export function getArtifactTypeByJavaRuntime(runtime: string | undefined): string {
        if (isJavaSERuntime(runtime)) {
            return 'jar';
        } else if (isJavaWebContainerRuntime(runtime)) {
            return 'war';
        } else {
            throw new Error(`Invalid java runtime: ${runtime}`);
        }
    }

    export function isJavaSERequiredPortConfigured(appSettings: StringDictionary | undefined): boolean {
        if (appSettings && appSettings.properties) {
            for (const key of Object.keys(appSettings.properties)) {
                if (key.toUpperCase() === PORT_KEY) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Return if all of the workspace folders contain Java projects in their base paths.
     * Only Maven and Gradle are taken into consideration for now.
     */
    export async function isJavaProject(): Promise<boolean> {
        if (!workspace.workspaceFolders) {
            return false;
        }

        for (const workspaceFolder of workspace.workspaceFolders) {
            if (await fse.pathExists(path.join(workspaceFolder.uri.fsPath, 'pom.xml')) ||
                await fse.pathExists(path.join(workspaceFolder.uri.fsPath, 'build.gradle'))) {
                continue;
            }
            return false;
        }

        return true;
    }

    export async function configureJavaSEAppSettings(node: SiteTreeItem): Promise<StringDictionary | undefined> {
        const appSettings: StringDictionary = await node.root.client.listApplicationSettings();
        if (isJavaSERequiredPortConfigured(appSettings)) {
            return undefined;
        }

        // tslint:disable-next-line:strict-boolean-expressions
        appSettings.properties = appSettings.properties || {};
        const port: string = await ext.ui.showInputBox({
            value: DEFAULT_PORT,
            prompt: 'Configure the PORT (Application Settings) which your Java SE Web App exposes',
            placeHolder: 'PORT',
            validateInput: (input: string): string | undefined => {
                return /^[0-9]+$/.test(input) ? undefined : 'please specify a valid port number';
            }
        });
        if (!port) {
            throw new UserCancelledError();
        }
        appSettings.properties[PORT_KEY] = port;
        return node.root.client.updateApplicationSettings(appSettings);
    }

    export async function showQuickPickByFileExtension(context: IActionContext, placeHolderString: string, fileExtension: string = '*'): Promise<string> {
        const files: vscode.Uri[] = await vscode.workspace.findFiles(`**/*.${fileExtension}`);
        const quickPickItems: IAzureQuickPickItem<string | undefined>[] = files.map((uri: vscode.Uri) => {
            return {
                label: path.basename(uri.fsPath),
                description: uri.fsPath,
                data: uri.fsPath
            };
        });

        quickPickItems.push({ label: '$(package) Browse...', description: '', data: undefined });

        const quickPickOption = { placeHolder: placeHolderString };
        const pickedItem = await vscode.window.showQuickPick(quickPickItems, quickPickOption);

        if (!pickedItem) {
            context.telemetry.properties.cancelStep = `show${fileExtension}`;
            throw new UserCancelledError();
        } else if (!pickedItem.data) {
            const browseResult = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
                filters: { Artifacts: [fileExtension] }
            });

            if (!browseResult) {
                context.telemetry.properties.cancelStep = `show${fileExtension}Browse`;
                throw new UserCancelledError();
            }

            return browseResult[0].fsPath;
        } else {
            return pickedItem.data;
        }
    }
}
