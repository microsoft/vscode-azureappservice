/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getResourceGroupsTestApi } from "./resourceGroupsTestApiAccess";

/**
 * Sets up the Azure DevOps subscription provider for CI/nightly tests.
 * This reads federated credentials from environment variables and configures
 * the Azure Resources extension's test API override so that the tree shows
 * real subscriptions instead of "Sign in to Azure..." placeholders.
 *
 * Required environment variables:
 * - AzCode_ServiceConnectionID: The Azure DevOps service connection ID
 * - AzCode_ServiceConnectionDomain: The tenant/domain ID
 * - AzCode_ServiceConnectionClientID: The client ID for authentication
 *
 * @throws Error if any required environment variables are missing or sign-in fails
 */
export async function setupAzureDevOpsSubscriptionProvider(): Promise<void> {
    const serviceConnectionId: string | undefined = process.env['AzCode_ServiceConnectionID'];
    const domain: string | undefined = process.env['AzCode_ServiceConnectionDomain'];
    const clientId: string | undefined = process.env['AzCode_ServiceConnectionClientID'];

    if (!serviceConnectionId || !domain || !clientId) {
        throw new Error(
            `Using Azure DevOps federated credentials, but federated service connection is not configured\n` +
            `  process.env.AzCode_ServiceConnectionID: ${serviceConnectionId ? "✅" : "❌"}\n` +
            `  process.env.AzCode_ServiceConnectionDomain: ${domain ? "✅" : "❌"}\n` +
            `  process.env.AzCode_ServiceConnectionClientID: ${clientId ? "✅" : "❌"}\n`
        );
    }

    // Dynamic import to avoid loading AzDO dependencies unless actually needed
    const { createAzureDevOpsSubscriptionProviderFactory } = await import("@microsoft/vscode-azext-azureauth/azdo");

    const factory = createAzureDevOpsSubscriptionProviderFactory({
        serviceConnectionId,
        tenantId: domain,
        clientId,
    });

    const provider = await factory();

    // Sign in to establish the token credential.
    // This must be done before the provider can return subscriptions.
    const signedIn = await provider.signIn();

    if (!signedIn) {
        throw new Error('Failed to sign in with Azure DevOps federated credentials');
    }

    console.log('Successfully signed in with Azure DevOps federated credentials');

    // Set the override on the RG extension's test API so its tree loads real subscriptions
    const rgTestApi = await getResourceGroupsTestApi();
    rgTestApi.testing.setOverrideAzureSubscriptionProvider(() => provider);
}
