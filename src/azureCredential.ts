/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Extension, extensions } from 'vscode';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureLogin, AzureAccount } from './azurelogin.api';

export class NotSignedInError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

export class AzureCredential {
    private loginExtension: Extension<AzureLogin> | null;

    constructor(private conext: ExtensionContext) {
        this.loginExtension = extensions.getExtension<AzureLogin>('chrisdias.vscode-azurelogin');
    }

    public getCredential(): ServiceClientCredentials {
        if (this.loginExtension && this.loginExtension.exports.account) {
            return this.loginExtension.exports.account.credentials;
        }
        throw new NotSignedInError();
    }
}