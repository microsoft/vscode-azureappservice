/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { type ContainerRegistryManagementClient } from '@azure/arm-containerregistry';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { localize } from '../../localize';
import { createContainerRegistryClient, createWebSiteClient } from '../../utils/azureClients';
import { getRandomHexString } from '../../utils/randomUtils';
import { type IDeployImageWizardContext } from './IDeployImageContext';

function isDockerHub(registryName: string): boolean {
    return registryName === 'docker.io' || registryName === 'index.docker.io';
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

        if (options.acrResourceId) {
            await this.createAcrWebhook(context, webhookTargetUri);
        } else if (isDockerHub(options.registryName)) {
            await this.showDockerHubWebhookMessage(options, webhookTargetUri);
        }
    }

    public shouldExecute(context: IDeployImageWizardContext): boolean {
        const options = context.deployImageOptions;
        return !!context.site && (!!options.acrResourceId || isDockerHub(options.registryName));
    }

    private async createAcrWebhook(context: IDeployImageWizardContext, webhookTargetUri: string): Promise<void> {
        const options = context.deployImageOptions;
        const acrResourceGroup = nonNullProp(options, 'acrResourceGroup');
        const registryShortName = nonNullProp(options, 'acrResourceName');

        const registryClient: ContainerRegistryManagementClient = await createContainerRegistryClient(context);
        const registry = await registryClient.registries.get(acrResourceGroup, registryShortName);

        // Parse repository and tag from image name
        // Image format: "myacr.azurecr.io/myapp:latest" or "myacr.azurecr.io/ns/myapp:latest"
        const imageWithoutRegistry = options.image.replace(`${options.registryName}/`, '');
        const colonIndex = imageWithoutRegistry.lastIndexOf(':');
        const repoName = colonIndex > -1 ? imageWithoutRegistry.substring(0, colonIndex) : imageWithoutRegistry;
        const tagName = colonIndex > -1 ? imageWithoutRegistry.substring(colonIndex + 1) : 'latest';

        // Webhook name: sanitize site name (alphanumeric only), truncate to 44 chars, append 6 random hex chars
        const sanitizedName = nonNullProp(context, 'newSiteName').replace(/[^a-zA-Z0-9]/g, '');
        const truncatedName = sanitizedName.substring(0, 44);
        const webhookName = `${truncatedName}${getRandomHexString(6)}`;

        await registryClient.webhooks.beginCreateAndWait(acrResourceGroup, registryShortName, webhookName, {
            location: nonNullProp(registry, 'location'),
            serviceUri: webhookTargetUri,
            scope: `${repoName}:${tagName}`,
            actions: ['push'],
            status: 'enabled',
        });
    }

    private async showDockerHubWebhookMessage(options: IDeployImageWizardContext['deployImageOptions'], webhookTargetUri: string): Promise<void> {
        // Parse repository name from image for Docker Hub URL
        const imageWithoutRegistry = options.image.replace(`${options.registryName}/`, '');
        const colonIndex = imageWithoutRegistry.lastIndexOf(':');
        const repoName = colonIndex > -1 ? imageWithoutRegistry.substring(0, colonIndex) : imageWithoutRegistry;

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
