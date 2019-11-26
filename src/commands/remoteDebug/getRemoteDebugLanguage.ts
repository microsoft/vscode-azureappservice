/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { RemoteDebugLanguage } from 'vscode-azureappservice';
import { IActionContext } from 'vscode-azureextensionui';
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';

export function getRemoteDebugLanguage(siteConfig: SiteConfigResource, context: IActionContext): RemoteDebugLanguage {
    // We read siteConfig.linuxFxVersion to find the image version:
    //   If the app is running Windows, it will be empty
    //   If the app is running a blessed Linux image, it will contain the language and version, e.g. "NODE|8.11"
    //   If the app is running a custom Docker image, it will contain the Docker registry information, e.g. "DOCKER|repo.azurecr.io/image:tag"

    const enablePythonRemoteDebugging = getWorkspaceSetting<boolean>('enablePythonRemoteDebugging');

    if (siteConfig.linuxFxVersion) {
        let version = siteConfig.linuxFxVersion.toLowerCase();

        // Docker images will contain registry information that shouldn't be included in telemetry, so remove that information
        if (version.startsWith('docker')) {
            version = 'docker';
        }

        // Add the version to telemtry for this action
        context.telemetry.properties.linuxFxVersion = version;

        if (version.startsWith('node')) {
            const splitVersion = version.split('|');
            if (splitVersion.length > 1 && isNodeVersionSupported(splitVersion[1])) {
                return RemoteDebugLanguage.Node;
            } else {
                throw new Error('Azure Remote Debugging is currently only supported for Node.js version >= 8.11 on Linux.');
            }
        }

        if (enablePythonRemoteDebugging && version.startsWith('python')) {
            return RemoteDebugLanguage.Python;
        }
    }

    if (enablePythonRemoteDebugging) {
        throw new Error('Azure Remote Debugging is currently only supported for Node.js and Python apps on Linux.');
    } else {
        throw new Error('Azure Remote Debugging is currently only supported for Node.js apps on Linux.');
    }
}

// Remote debugging is currently only supported for Node.js >= 8.11
function isNodeVersionSupported(nodeVersion: string): boolean {
    // the portal's Node runtimes includes several LTS versions i.e. (12-lts)
    if (/lts/.test(nodeVersion)) {
        return true;
    }

    const splitNodeVersion = nodeVersion.split('.');
    if (splitNodeVersion.length < 2) {
        return false;
    }

    const major = +splitNodeVersion[0];
    const minor = +splitNodeVersion[1];

    return (major > 8 || (major === 8 && minor >= 11));
}
