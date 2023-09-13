/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IDeployContext } from '@microsoft/vscode-azext-azureappservice';
import { AzExtFsExtra } from '@microsoft/vscode-azext-utils';
import * as parser from 'fast-xml-parser';
import * as path from 'path';

type MavenModule = { path: string, artifactId: string, artifactFinalName: string };
type MavenPom = {
    project: {
        parent?: { version?: string },
        artifactId: string,
        version?: string,
        packaging?: string,
        build?: { finalName?: string }
    }
}

export async function tryGetMavenModule(context: IDeployContext, projectPath: string): Promise<MavenModule | undefined> {
    const pomFile = path.join(projectPath, 'pom.xml');
    if ((await AzExtFsExtra.pathExists(projectPath)) && (await AzExtFsExtra.isDirectory(projectPath) && (await AzExtFsExtra.pathExists(pomFile)))) {
        return getMavenModuleFromPom(pomFile);
    }
    return undefined;
}

async function getMavenModuleFromPom(pomFile: string): Promise<MavenModule | undefined> {
    const pomContent: string = await AzExtFsExtra.readFile(pomFile);
    try {
        const pom = parser.parse(pomContent) as MavenPom;
        const pj = pom.project;
        if (pj && pj.artifactId) {
            const version = pj.version || pj.parent?.version;
            const defaultName = version ? `${pj.artifactId}-${version}` : pj.artifactId;
            const artifactFinalName = `${pj.build?.finalName ?? defaultName}.${pj.packaging || 'jar'}`;
            return {
                path: path.dirname(pomFile),
                artifactId: pom.project.artifactId,
                artifactFinalName
            };
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
}
