/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "azure-arm-website/lib/models";
import * as fse from 'fs-extra';
import * as path from 'path';
import { workspace } from "vscode";
import { UserCancelledError } from 'vscode-azureextensionui';
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { ext } from '../extensionVariables';

export namespace javaUtils {
    const DEFAULT_PORT: string = '8080';
    const PORT_KEY: string = 'PORT';

    function isJavaWebContainerRuntime(runtime: string | undefined): boolean {
        return !!runtime && /^(tomcat|wildfly)/i.test(runtime);
    }

    function isJavaSERuntime(runtime: string | undefined): boolean {
        return !!runtime && /^java/i.test(runtime);
    }

    export function isJavaRuntime(runtime: string | undefined): boolean {
        return isJavaWebContainerRuntime(runtime) || isJavaSERuntime(runtime);
    }

    function isJavaArtifact(artifactPath: string): boolean {
        return /^(.jar|.war)/i.test(path.extname(artifactPath));
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

    export function getJavaArtifactExtensions(): string[] {
        return ['jar', 'war'];
    }

    function isJavaSERequiredPortConfigured(appSettings: StringDictionary | undefined): boolean {
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
     * Or if optional fsPath passed in is a Java artifact or project
     * Only Maven and Gradle are taken into consideration for now.
     */
    export async function isJavaProject(deployFsPath?: string): Promise<boolean> {

        // if there is a deployed project path, use that for the default
        if (deployFsPath) {
            return await isJavaFolder(deployFsPath) || isJavaArtifact(deployFsPath);
        }

        if (!workspace.workspaceFolders) {
            return false;
        }

        for (const workspaceFolder of workspace.workspaceFolders) {
            if (await isJavaFolder(workspaceFolder.uri.fsPath)) {
                continue;
            }
            return false;
        }

        return true;
    }

    async function isJavaFolder(fsPath: string): Promise<boolean> {
        return await fse.pathExists(path.join(fsPath, 'pom.xml')) || await fse.pathExists(path.join(fsPath, 'build.gradle'));
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
}
