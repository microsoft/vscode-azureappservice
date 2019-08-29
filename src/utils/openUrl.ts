
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { commands, Uri } from 'vscode';

export async function openUrl(url: string): Promise<void> {
    await commands.executeCommand('vscode.open', Uri.parse(url));
}
