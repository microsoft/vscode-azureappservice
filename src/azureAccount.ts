/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Extension, extensions } from 'vscode';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { AzureLogin, AzureSession, AzureLoginStatus } from './azurelogin.api';

export class NotSignedInError extends Error { }

export class CredentialError extends Error { }

export class AzureAccount {
    readonly loginExtension: Extension<AzureLogin> | null;

    constructor(readonly extensionConext: ExtensionContext) {
        this.loginExtension = extensions.getExtension<AzureLogin>('chrisdias.vscode-azurelogin');
    }

    getAzureSessions(): AzureSession[] {
        const status = this.loginExtension.exports.status;
        if (status !== 'LoggedIn') {
            throw new NotSignedInError(status)
        }
        return this.loginExtension.exports.sessions;
    }

    getCredentialByTenantId(tenantId: string): ServiceClientCredentials {
        const session = this.getAzureSessions().find((s, i, array) => s.tenantId.toLowerCase() === tenantId.toLowerCase());

        if (session) {
            return session.credentials;
        }

        throw new CredentialError(`Failed to get credential, tenant ${tenantId} not found.`);
    }

    get signInStatus(): AzureLoginStatus {
        return this.loginExtension.exports.status;
    }

    async getSubscriptions(): Promise<SubscriptionModels.Subscription[]> {
        const tasks = new Array<Promise<SubscriptionModels.Subscription[]>>();
        
        this.getAzureSessions().forEach((s, i, array) => {
            const client = new SubscriptionClient(s.credentials);
            const tenantId = s.tenantId;
            tasks.push(client.subscriptions.list().then<SubscriptionModels.Subscription[]>((result) => {
                return result.map<SubscriptionModels.Subscription>((value) => {
                    // The list() API doesn't include tenantId information in the subscription object, 
                    // however many places that uses subscription objects will be needing it, so we just create 
                    // a copy of the subscription object with the tenantId value.
                    return {
                        id: value.id,
                        subscriptionId: value.subscriptionId,
                        tenantId: tenantId,
                        displayName: value.displayName,
                        state: value.state,
                        subscriptionPolicies: value.subscriptionPolicies,
                        authorizationSource: value.authorizationSource
                    };
                });
            }));
        });
        
        const results = await Promise.all(tasks);
        const subscriptions = new Array<SubscriptionModels.Subscription>();
        
        results.forEach((result) => result.forEach((subscription) => subscriptions.push(subscription)));
        return subscriptions;
    }

    registerSessionsChangedListener(listener: (e: void) => any, thisArg: any) {
        let disposable = this.loginExtension.exports.onSessionsChanged(listener, thisArg);
        this.extensionConext.subscriptions.push(disposable);
    }
}