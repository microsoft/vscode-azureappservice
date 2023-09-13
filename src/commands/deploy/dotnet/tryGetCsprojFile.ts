/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IDeployContext } from '@microsoft/vscode-azext-azureappservice';
import { AzExtFsExtra } from '@microsoft/vscode-azext-utils';
import * as path from 'path';

export async function tryGetCsprojFile(context: IDeployContext, projectPath: string): Promise<string | undefined> {
    const projectFiles: string[] = await checkFolderForCsproj(projectPath);
    // it's a common pattern to have the .csproj file in a subfolder so check one level deeper
    if (projectFiles.length === 0) {
        const subfolders = await AzExtFsExtra.readDirectory(projectPath);
        await Promise.all(subfolders.map(async folder => {
            const filePath: string = path.join(projectPath, folder.fsPath);
            // check its existence as this will check .vscode even if the project doesn't contain that folder
            if (await AzExtFsExtra.pathExists(filePath) && (await AzExtFsExtra.isDirectory(filePath))) {
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
    const files = await AzExtFsExtra.readDirectory(filePath);
    const filePaths: string[] = files.map((f) => {
        return path.join(filePath, f.fsPath);
    });

    return filePaths.filter((f: string) => /\.csproj$/i.test(f));
}
