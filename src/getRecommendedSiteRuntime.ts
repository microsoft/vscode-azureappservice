/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { WorkspaceFolder } from "vscode";
import { LinuxRuntimes } from "vscode-azureappservice";
import { javaUtils } from './utils/javaUtils';
import { findFilesByFileExtension } from './utils/workspace';

export async function getRecommendedSiteRuntime(workspace: WorkspaceFolder): Promise<LinuxRuntimes[] | undefined> {
    const fsPath = workspace.uri.fsPath;
    let recommendedSiteRuntime: LinuxRuntimes[] | undefined;
    let foundRecommendation: boolean = false;

    if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
        recommendedSiteRuntime = [LinuxRuntimes.node];
        foundRecommendation = true;
    }

    // requirements.txt are used to pip install so a good way to determine it's a Python app
    if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
        // if we already found a recommendation but are here, we should back out and not use a default because we don't want to lock users into a siteRuntime
        if (foundRecommendation) {
            return undefined;
        }

        recommendedSiteRuntime = [LinuxRuntimes.python];
        foundRecommendation = true;

    }

    if ((await findFilesByFileExtension(fsPath, 'csproj')).length > 0) {
        if (foundRecommendation) {
            return undefined;
        }

        recommendedSiteRuntime = [LinuxRuntimes.dotnet];
        foundRecommendation = true;
    }

    if (await javaUtils.isJavaProject(fsPath)) {
        if (foundRecommendation) {
            return undefined;
        }

        recommendedSiteRuntime = [
            LinuxRuntimes.java,
            LinuxRuntimes.tomcat,
            LinuxRuntimes.wildfly
        ];
    }

    return recommendedSiteRuntime;
}
