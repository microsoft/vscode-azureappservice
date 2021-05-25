/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import { SiteConfigResource } from "@azure/arm-appservice/esm/models";
import * as parser from 'fast-xml-parser';
import * as fse from 'fs-extra';
import * as path from 'path';
import { workspace, WorkspaceFolder } from "vscode";
import { UserCancelledError } from 'vscode-azureextensionui';
import * as constants from "../constants";
import { SiteTreeItem } from "../explorer/SiteTreeItem";
import { ext } from '../extensionVariables';
import { localize } from "../localize";
import { findFilesByFileExtension } from "./workspace";

interface MavenArtifact {
    name: string;
    description?: string;
    workspace?: string;
    file: string;
    ext: string;
    module: string
    pom: any,
}

export namespace javaUtils {
    const DEFAULT_PORT: string = '8080';
    const PORT_KEY: string = 'PORT';
    const JAVA_WEB_CONTAINER_REGEX: RegExp = /^(tomcat|wildfly|jboss)/i;
    const JAVA_SE_REGEX: RegExp = /^java/i;

    function isJavaWebContainerRuntime(runtime: SiteConfigResource | undefined): boolean {
        return (!!runtime?.javaContainer && (JAVA_WEB_CONTAINER_REGEX.test(runtime.javaContainer)) || (!!runtime?.linuxFxVersion && JAVA_WEB_CONTAINER_REGEX.test(runtime.linuxFxVersion)));
    }

    function isJavaSERuntime(runtime: SiteConfigResource | undefined): boolean {
        return (!!runtime?.javaContainer && (JAVA_SE_REGEX.test(runtime.javaContainer)) || (!!runtime?.linuxFxVersion && JAVA_SE_REGEX.test(runtime.linuxFxVersion)));
    }

    export function isJavaRuntime(siteConfig: SiteConfigResource | undefined): boolean {
        return isJavaWebContainerRuntime(siteConfig) || isJavaSERuntime(siteConfig);
    }

    function isJavaArtifact(artifactPath: string): boolean {
        return /^(.jar|.war)/i.test(path.extname(artifactPath));
    }

    function getJavaArtifactExtensions(): string[] {
        return ['jar', 'war'];
    }

    function isJavaSERequiredPortConfigured(appSettings: WebSiteManagementModels.StringDictionary | undefined): boolean {
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

        // if there's no workspace, it can return an empty array
        if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
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

    export function isMavenModule(fsPath: string): boolean {
        return fse.existsSync(fsPath) &&
            fse.lstatSync(fsPath).isDirectory() &&
            fse.existsSync(path.join(fsPath, 'pom.xml'));
    }

    export function getMavenArtifactsInWorkspace(fileExtensions: string | string[] | undefined): MavenArtifact[] {
        fileExtensions = typeof fileExtensions === 'string' ? [fileExtensions] : fileExtensions || [];
        const artifacts: MavenArtifact[] = [];
        (workspace.workspaceFolders ?? []).map(f => f.uri.fsPath).forEach(f => {
            const wfArtifacts = findPomFiles(f).map(p => getMavenArtifact(p, f)).filter(a => fileExtensions?.includes(a.ext));
            artifacts.push(...wfArtifacts);
        });
        return artifacts;
    }

    export function getMavenArtifact(pomFile: string, ws?: string): MavenArtifact {
        const pom = parser.parse(fse.readFileSync(pomFile, 'utf8'));
        const module = path.dirname(pomFile);
        const moduleRelativePath = path.relative(ws || workspace.workspaceFolders?.[0].uri.fsPath || module, module);
        const pj = pom.project;
        const fileName = `${pj.artifactId}-${pj.version || pj.parent?.version}.${pj.packaging || 'jar'}`;
        return {
            name: `Maven: ${pj.groupId || pj.parent.groupId}:${pj.artifactId}:${pj.version || pj.parent.version}`,
            description: path.join(moduleRelativePath, 'target', fileName),
            workspace: ws,
            module,
            file: path.join(module, 'target', fileName),
            ext: pj.packaging || 'jar',
            pom
        }
    }

    function findPomFiles(root: string): string[] {
        if (!fse.existsSync(root) || !fse.lstatSync(root).isDirectory()) {
            return [];
        }
        const pomFiles: string[] = [];
        const dirs: string[] = [root];
        while (dirs.length > 0) {
            const d: string = dirs.shift()!;
            dirs.push(...(fse.readdirSync(d).map(f => path.join(d, f)).filter(f => fse.statSync(f).isDirectory())));
            const pomFile = path.join(d, 'pom.xml');
            if (fse.existsSync(pomFile)) {
                pomFiles.push(pomFile);
            }
        }
        return pomFiles;
    }

    export async function getLocalMavenWrapper(modulePath: string): Promise<string | undefined> {
        const mvnw: string = constants.isWindows ? "mvnw.cmd" : "mvnw";
        // walk up parent folders
        let current: string = modulePath;
        while (path.basename(current)) {
            const potentialMvnwPath: string = path.join(current, mvnw);
            if (await fse.pathExists(potentialMvnwPath)) {
                return potentialMvnwPath;
            }
            current = path.dirname(current);
        }
        return undefined;
    }

    export async function configureJavaSEAppSettings(node: SiteTreeItem): Promise<WebSiteManagementModels.StringDictionary | undefined> {
        const appSettings: WebSiteManagementModels.StringDictionary = await node.root.client.listApplicationSettings();
        if (isJavaSERequiredPortConfigured(appSettings)) {
            return undefined;
        }

        appSettings.properties = appSettings.properties || {};
        const port: string = await ext.ui.showInputBox({
            value: DEFAULT_PORT,
            prompt: localize('configurePort', 'Configure the PORT (Application Settings) which your Java SE Web App exposes'),
            placeHolder: 'PORT',
            validateInput: (input: string): string | undefined => {
                return /^[0-9]+$/.test(input) ? undefined : localize('validPort', 'please specify a valid port number');
            }
        });
        if (!port) {
            throw new UserCancelledError();
        }
        appSettings.properties[PORT_KEY] = port;
        return node.root.client.updateApplicationSettings(appSettings);
    }

    export async function getJavaFileExtensions(siteConfig: WebSiteManagementModels.SiteConfigResource | undefined): Promise<string[] | undefined> {
        if (isJavaSERuntime(siteConfig)) {
            return ['jar'];
        } else if (isJavaWebContainerRuntime(siteConfig)) {
            return ['war'];
        } else if (await isJavaProject()) {
            return getJavaArtifactExtensions();
        }
        return;
    }

    export async function getArtifactsByFileExtensions(fileExtensions: string[] | undefined): Promise<string[] | undefined> {
        if (fileExtensions) {
            const workspaceFolder: WorkspaceFolder | undefined = workspace.workspaceFolders && workspace.workspaceFolders.length === 1 ? workspace.workspaceFolders[0] : undefined;
            const targetFolder: string | undefined = workspaceFolder ? path.join(workspaceFolder?.uri.fsPath, "target") : undefined;
            const javaArtifactPath: string | undefined = targetFolder && await fse.pathExists(targetFolder) ? targetFolder : undefined;
            // If there is a target folder, only check the folder for the file extension, otherwise use all currently opened workspaces
            return (await Promise.all(fileExtensions.map(async ext => await findFilesByFileExtension(javaArtifactPath, ext))))
                .reduce((acc, val) => acc.concat(val), [])
                .map(uri => uri.fsPath);
        }
        return;
    }

}
