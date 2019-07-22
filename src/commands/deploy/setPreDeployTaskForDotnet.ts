/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { Uri } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import * as constants from '../../constants';
import { findFilesByFileExtension, mapFilesToQuickPickItems } from '../../utils/workspace';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../../vsCodeConfig/settings';
import * as tasks from '../../vsCodeConfig/tasks';
import { IDeployWizardContext } from "../createWebApp/setAppWizardContextDefault";

export async function setPreDeployTaskForDotnet(context: IDeployWizardContext, siteConfig: SiteConfig): Promise<void> {
    // don't overwrite preDeploy task if it exists
    if (!getWorkspaceSetting<boolean>('configurePreDeployTasks', context.workspace.uri.fsPath) || getWorkspaceSetting<boolean>(constants.configurationSettings.preDeployTask, context.workspace.uri.fsPath)) {
        return;
    }

    // assume that the csProj is in the root
    let csProjFsPath: string = context.workspace.uri.fsPath;

    const csProjInRoot: Uri[] = await findFilesByFileExtension(context.workspace.uri.fsPath, 'csproj');
    let csProjInSubfolders: Uri[] = [];

    // if there was no .csproj in the root space, try to find it within subfolders
    if (csProjInRoot.length === 0) {
        // to have a recursive search of the opened workspace, pass in undefined rather than the fsPath
        csProjInSubfolders = await findFilesByFileExtension(undefined, 'csproj');
        try {
            if (csProjInSubfolders.length === 1) {
                csProjFsPath = csProjInSubfolders[0].fsPath;
            } else if (csProjInSubfolders.length > 1) {
                csProjFsPath = (await ext.ui.showQuickPick(mapFilesToQuickPickItems(csProjInSubfolders), { placeHolder: 'Select a .csproj file' })).data;
            } else {
                // exit the try/catch if no csproj file is found
                throw new Error();
            }

            // remove the .csproj from the path name
            csProjFsPath = path.dirname(csProjFsPath);
        } catch (error) {
            // ignore the error if no .csproj was found or the user cancelled selection
        }
    }

    if (csProjInRoot.length > 0 || csProjFsPath.length > 0 || (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().includes('dotnet'))) {
        // follow the publish output patterns, but leave out targetFramework
        // use the absolute path so the bits are created in the root, not the subpath
        const dotnetOutputPath: string = path.join(csProjFsPath, 'bin', 'Debug', 'publish');

        await updateWorkspaceSetting(constants.configurationSettings.preDeployTask, 'publish', context.workspace.uri.fsPath);
        await updateWorkspaceSetting(constants.configurationSettings.deploySubpath, dotnetOutputPath, context.workspace.uri.fsPath);

        const publishCommand: string = `dotnet publish ${csProjFsPath} -o ${dotnetOutputPath}`;
        const publishTask: tasks.ITask[] = [{
            label: 'clean',
            command: `dotnet clean ${csProjFsPath}`,
            type: 'shell'
        },
        {
            label: 'publish',
            command: publishCommand,
            type: 'shell',
            dependsOn: 'clean'
        }];

        tasks.updateTasks(context.workspace, publishTask);

    }
}
