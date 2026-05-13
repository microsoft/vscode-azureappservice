/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { type ServiceClient } from '@azure/core-client';
import { createHttpHeaders, createPipelineRequest } from '@azure/core-rest-pipeline';
import { createGenericClient } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { localize } from '../../localize';
import { createWebSiteClient } from '../../utils/azureClients';
import { getRandomHexString } from '../../utils/randomUtils';
import { type IDeployImageWizardContext } from './IDeployImageContext';

function isDockerHub(registryName: string): boolean {
    return registryName.endsWith('docker.io');
}

export class CreateWebhookStep extends AzureWizardExecuteStepWithActivityOutput<IDeployImageWizardContext> {
    public priority: number = 142;
    public stepName: string = 'createWebhookStep';
    protected getOutputLogSuccess = () =>
        localize('createdWebhook', 'Successfully configured CI/CD webhook');
    protected getOutputLogFail = () =>
        localize('failedWebhook', 'Failed to configure CI/CD webhook');
    protected getTreeItemLabel = () =>
        localize('createWebhook', 'Configure CI/CD webhook');

    public async execute(context: IDeployImageWizardContext, progress: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        const options = context.deployImageOptions;
        const siteName: string = nonNullProp(context, 'newSiteName');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');

        progress.report({ message: localize('configuringWebhook', 'Configuring CI/CD webhook...') });

        // Get publish credentials to construct webhook target URI
        const webClient: WebSiteManagementClient = await createWebSiteClient(context);
        const publishCreds = await webClient.webApps.beginListPublishingCredentialsAndWait(rgName, siteName);
        const webhookTargetUri = `${publishCreds.scmUri}/api/registry/webhook`;

        if (options.acrRegistry) {
            await this.createAcrWebhook(context, webhookTargetUri);
        } else if (isDockerHub(options.registryName)) {
            await this.showDockerHubWebhookMessage(options, webhookTargetUri);
        }
    }

    public shouldExecute(context: IDeployImageWizardContext): boolean {
        const options = context.deployImageOptions;
        return !!context.site && (!!options.acrRegistry || isDockerHub(options.registryName));
    }

    private async createAcrWebhook(context: IDeployImageWizardContext, webhookTargetUri: string): Promise<void> {
        const options = context.deployImageOptions;
        const acrRegistry = nonNullProp(options, 'acrRegistry');

        const repoName = options.repositoryName;
        const tagName = options.tag || 'latest';

        // Webhook name: sanitize site name (alphanumeric only), truncate to 44 chars, append 6 random hex chars
        const sanitizedName = nonNullProp(context, 'newSiteName').replace(/[^a-zA-Z0-9]/g, '');
        const truncatedName = sanitizedName.substring(0, 44);
        const webhookName = `${truncatedName}${getRandomHexString(6)}`;

        // Use a generic ARM PUT instead of the containerregistry SDK to avoid a package dependency
        const client: ServiceClient = await createGenericClient(context, context);
        await client.sendRequest(createPipelineRequest({
            method: 'PUT',
            url: `${acrRegistry.id}/webhooks/${webhookName}?api-version=2023-07-01`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: createHttpHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                location: acrRegistry.location,
                properties: {
                    serviceUri: webhookTargetUri,
                    scope: `${repoName}:${tagName}`,
                    actions: ['push'],
                    status: 'enabled',
                },
            }),
        }));
    }

    private async showDockerHubWebhookMessage(options: IDeployImageWizardContext['deployImageOptions'], webhookTargetUri: string): Promise<void> {
        const repoName = options.repositoryName;

        const dockerHubUrl = `https://cloud.docker.com/repository/docker/${repoName}/webHooks`;
        const copyWebhookUrl = localize('copyWebhookUrl', 'Copy Webhook URL');
        const openDockerHub = localize('openDockerHub', 'Open Docker Hub');
        const message = localize(
            'dockerHubWebhook',
            'To enable CI/CD, add the webhook URL in Docker Hub.',
        );

        void vscode.window.showInformationMessage(message, copyWebhookUrl, openDockerHub).then(async (result) => {
            if (result === copyWebhookUrl) {
                await vscode.env.clipboard.writeText(webhookTargetUri);
            } else if (result === openDockerHub) {
                await vscode.env.openExternal(vscode.Uri.parse(dockerHubUrl));
            }
        });
    }
}
