/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { localize } from './localize';

// tslint:disable: export-name
export class OperationNotSupportedError extends Error {
    constructor() {
        super(localize('notSupported', 'This operation is not supported.'));
    }
}
