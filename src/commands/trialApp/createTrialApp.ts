/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { openUrl } from '../../utils/openUrl';

export async function createTrialApp(_context: IActionContext): Promise<void> {
    await openUrl('https://code.visualstudio.com/tryappservice/?utm_source=appservice-extension');
}
