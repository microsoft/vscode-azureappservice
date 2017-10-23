/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { ServiceClientCredentials } from 'ms-rest';
import { Disposable, ExtensionContext, extensions } from 'vscode';
import { AzureAccount, AzureLoginStatus, AzureSession } from './azure-account.api';

export class NotSignedInError extends Error { }

export class CredentialError extends Error { }

export class AzureAccountWrapper {
    public readonly accountApi: AzureAccount;
    private readonly extensionContext: ExtensionContext;

    constructor(extensionContext: ExtensionContext) {
        // tslint:disable-next-line:no-non-null-assertion
        this.accountApi = extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;
        this.extensionContext = extensionContext;
    }

    public getAzureSessions(): AzureSession[] {
        const status = this.signInStatus;
        if (status !== 'LoggedIn') {
            throw new NotSignedInError(status);
        }

        return this.accountApi.sessions;
    }

    public getCredentialByTenantId(tenantId: string): ServiceClientCredentials {
        const session = this.getAzureSessions().find(s => s.tenantId.toLowerCase() === tenantId.toLowerCase());

        if (session) {
            return session.credentials;
        }

        throw new CredentialError(`Failed to get credential, tenant ${tenantId} not found.`);
    }

    get signInStatus(): AzureLoginStatus {
        return this.accountApi.status;
    }

    public getFilteredSubscriptions(): SubscriptionModels.Subscription[] {
        return this.accountApi.filters.map<SubscriptionModels.Subscription>(filter => {
            return {
                id: filter.subscription.id,
                subscriptionId: filter.subscription.subscriptionId,
                tenantId: filter.session.tenantId,
                displayName: filter.subscription.displayName,
                state: filter.subscription.state,
                subscriptionPolicies: filter.subscription.subscriptionPolicies,
                authorizationSource: filter.subscription.authorizationSource
            };
        });
    }

    public async getLocationsBySubscription(subscription: SubscriptionModels.Subscription): Promise<SubscriptionModels.Location[]> {
        const credential = this.getCredentialByTenantId(subscription.tenantId);
        const client = new SubscriptionClient(credential);

        return <SubscriptionModels.Location[]>(await client.subscriptions.listLocations(subscription.subscriptionId));
    }

    public registerStatusChangedListener(listener: (e: AzureLoginStatus) => {}, thisArg: {}): Disposable {
        return this.accountApi.onStatusChanged(listener, thisArg, this.extensionContext.subscriptions);
    }

    public registerFiltersChangedListener(listener: (e: void) => {}, thisArg: {}): Disposable {
        return this.accountApi.onFiltersChanged(listener, thisArg, this.extensionContext.subscriptions);
    }
}
