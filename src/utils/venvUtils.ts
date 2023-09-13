/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra } from '@microsoft/vscode-azext-utils';
import * as path from 'path';

export namespace venvUtils {
    export async function getExistingVenvs(projectPath: string): Promise<string[]> {
        const venvs: string[] = [];
        const fsPaths = await AzExtFsExtra.readDirectory(projectPath);
        await Promise.all(fsPaths.map(async (venvName) => {
            if (await venvExists(venvName.fsPath, projectPath)) {
                venvs.push(venvName.fsPath);
            }
        }));

        return venvs;
    }

    export async function venvExists(venvName: string, rootFolder: string): Promise<boolean> {
        const venvPath: string = path.join(rootFolder, venvName);
        if (await AzExtFsExtra.pathExists(venvPath)) {
            if (await AzExtFsExtra.isDirectory(venvPath)) {
                const venvActivatePath: string = getVenvPath(venvName, 'activate', process.platform, path.join);
                if (await AzExtFsExtra.pathExists(path.join(rootFolder, venvActivatePath))) {
                    return true;
                }
            }
        }
        return false;
    }

    function getVenvPath(venvName: string, lastFs: string, platform: NodeJS.Platform, pathJoin: (...p: string[]) => string): string {
        const middleFs: string = platform === 'win32' ? 'Scripts' : 'bin';
        const paths: string[] = ['.', venvName, middleFs, lastFs];
        return pathJoin(...paths);
    }
}
