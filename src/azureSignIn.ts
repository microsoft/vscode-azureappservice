/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Extension, extensions } from 'vscode';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { AzureLogin, AzureAccount } from './azurelogin.api';

export class NotSignedInError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

export class AzureSignIn {
    private loginExtension: Extension<AzureLogin> | null;

    constructor(private extensionConext: ExtensionContext) {
        this.loginExtension = extensions.getExtension<AzureLogin>('chrisdias.vscode-azurelogin');
    }

    getCredentials(): ServiceClientCredentials {
        if (this.loginExtension && this.loginExtension.exports.account) {
            return this.loginExtension.exports.account.credentials;
        }
        throw new NotSignedInError();
    }

    isSignedIn() : boolean {
        try {
            this.getCredentials();
        } catch (err) {
            if (err instanceof NotSignedInError) {
                return false;
            }
            throw err;
        }

        return true;
    }

    getTenantId(): string {
        return this.loginExtension.exports.account.tenantId;
    }

    getSubscriptions(): Promise<SubscriptionModels.Subscription[]> {
        const client = new SubscriptionClient(this.getCredentials());
        return client.subscriptions.list();
    }

    registerAccountChangedListener(listener: (e: AzureAccount) => any, thisArg: any) {
        let disposable = this.loginExtension.exports.onAccountChanged(listener, thisArg);
        this.extensionConext.subscriptions.push(disposable);
    }
}