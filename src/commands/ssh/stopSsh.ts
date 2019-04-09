/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WebAppTreeItem } from '../../explorer/WebAppTreeItem';
import { ext } from '../../extensionVariables';
import { sshSessionsMap, sshTerminal } from './startSsh';

export async function stopSsh(node?: SiteTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    }

    const sshTerminalName: string = node.root.client.fullName;

    const currentSshTerminal: sshTerminal | undefined = sshSessionsMap.get(sshTerminalName);

    if (!currentSshTerminal || !currentSshTerminal.running) {
        throw new Error(`Azure SSH is not currently running for "${sshTerminalName}".`);
    }

    if (currentSshTerminal.terminal) {
        currentSshTerminal.terminal.dispose();
    }
}
