/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext } from 'vscode-azureextensionui';
import { localize } from './localize';

export class OperationNotSupportedError extends Error {
    constructor(context: IActionContext) {
        context.errorHandling.suppressReportIssue = true;
        super(localize('notSupported', 'This operation is not supported.'));
    }
}
