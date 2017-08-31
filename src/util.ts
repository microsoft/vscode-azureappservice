/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionModels } from 'azure-arm-resource';
import { AzureAccountWrapper } from './azureAccountWrapper';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';


export interface PartialList<T> extends Array<T> {
    nextLink?: string;
}

export async function listAll<T>(client: { listNext(nextPageLink: string): Promise<PartialList<T>>; }, first: Promise<PartialList<T>>): Promise<T[]> {
    const all: T[] = [];

    for (let list = await first; list.length || list.nextLink; list = list.nextLink ? await client.listNext(list.nextLink) : []) {
        all.push(...list);
    }

    return all;
}

export function getSignInCommandString(): string {
    return 'azure-account.login';
}

export function getWebAppPublishCredential(azureAccount: AzureAccountWrapper, subscription: SubscriptionModels.Subscription, site: WebSiteModels.Site): Promise<WebSiteModels.User> {
    const credentials = azureAccount.getCredentialByTenantId(subscription.tenantId);
    const websiteClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
    return websiteClient.webApps.listPublishingCredentials(site.resourceGroup, site.name);
}
