/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { IDeployContext } from 'vscode-azureappservice';

export async function tryGetCsprojFile(context: IDeployContext, projectPath: string): Promise<string | undefined> {
    const projectFiles: string[] = await checkFolderForCsproj(projectPath);
    // it's a common pattern to have the .csproj file in a subfolder so check one level deeper
    if (projectFiles.length === 0) {
        const subfolders: string[] = await fse.readdir(projectPath);
        await Promise.all(subfolders.map(async folder => {
            const filePath: string = path.join(projectPath, folder);
            // check its existence as this will check .vscode even if the project doesn't contain that folder
            if (await fse.pathExists(filePath) && (await fse.stat(filePath)).isDirectory()) {
                projectFiles.push(...await checkFolderForCsproj(filePath));
                context.telemetry.properties.csprojInSubfolder = 'true';
            }
        }));
    }

    context.telemetry.properties.numOfCsprojFiles = projectFiles.length.toString();

    // if multiple csprojs were found, ignore them
    return projectFiles.length === 1 ? projectFiles[0] : undefined;
}

async function checkFolderForCsproj(filePath: string): Promise<string[]> {
    const files: string[] = await fse.readdir(filePath);
    const filePaths: string[] = files.map((f: string) => {
        return path.join(filePath, f);
    });

    return filePaths.filter((f: string) => /\.csproj$/i.test(f));
}
