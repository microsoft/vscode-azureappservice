/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';

export namespace venvUtils {
    export async function getExistingVenvs(projectPath: string): Promise<string[]> {
        const venvs: string[] = [];
        const fsPaths: string[] = await fse.readdir(projectPath);
        await Promise.all(fsPaths.map(async (venvName: string) => {
            if (await venvExists(venvName, projectPath)) {
                venvs.push(venvName);
            }
        }));

        return venvs;
    }

    export async function venvExists(venvName: string, rootFolder: string): Promise<boolean> {
        const venvPath: string = path.join(rootFolder, venvName);
        if (await fse.pathExists(venvPath)) {
            const stat: fse.Stats = await fse.stat(venvPath);
            if (stat.isDirectory()) {
                const venvActivatePath: string = getVenvPath(venvName, 'activate', process.platform, path.join);
                if (await fse.pathExists(path.join(rootFolder, venvActivatePath))) {
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
