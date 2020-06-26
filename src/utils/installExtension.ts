/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, extensions } from 'vscode';
import { delay } from '../utils/delay';

export async function installExtension(extensionId: string, timeoutInSeconds: number = 60): Promise<boolean> {
    const commandToRun: string = 'extension.open';
    commands.executeCommand(commandToRun, extensionId);

    // poll to see if the extension was installed for a minute
    const maxTime: number = Date.now() + timeoutInSeconds * 1000;

    while (Date.now() < maxTime) {
        if (extensions.getExtension(extensionId)) {
            return true;
        }
        await delay(5000);
    }
    return false;
}
