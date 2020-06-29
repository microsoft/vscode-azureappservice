/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, extensions } from 'vscode';
import { delay } from '../utils/delay';

/**
 * Returns `true` as soon as the extension is installed, or if the the extension is already installed. Returns `false` if the
 * extension isn't installed within `timeoutInSeconds` seconds.
 * @param extensionId id of the extension to install
 * @param timeoutInSeconds Maximum time to wait for the user to install the extension. Defaults to 60 seconds.
 */
export async function installExtension(extensionId: string, timeoutInSeconds: number = 60): Promise<boolean> {

    // poll to see if the extension was installed for a minute
    const maxTime: number = Date.now() + timeoutInSeconds * 1000;

    if (!extensions.getExtension(extensionId)) {
        const commandToRun: string = 'extension.open';
        commands.executeCommand(commandToRun, extensionId);
    }

    while (Date.now() < maxTime) {
        if (extensions.getExtension(extensionId)) {
            return true;
        }

        await delay(5000);
    }
    return false;
}
