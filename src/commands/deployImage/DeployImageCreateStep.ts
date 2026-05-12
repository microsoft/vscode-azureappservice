/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type NameValuePair, type Site, type SiteConfig, type WebSiteManagementClient } from '@azure/arm-appservice';
import { type ContainerRegistryManagementClient } from '@azure/arm-containerregistry';
import { LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp } from '@microsoft/vscode-azext-utils';
import { type AppResource } from '@microsoft/vscode-azext-utils/hostapi';
import { type Progress } from 'vscode';
import { webProvider } from '../../constants';
import { localize } from '../../localize';
import { createContainerRegistryClient, createWebSiteClient } from '../../utils/azureClients';
import { type IDeployImageWizardContext } from './IDeployImageContext';

export class DeployImageCreateStep extends AzureWizardExecuteStepWithActivityOutput<IDeployImageWizardContext> {
    public priority: number = 140;
    public stepName: string = 'deployImageCreateStep';
    protected getOutputLogSuccess = (context: IDeployImageWizardContext): string =>
        localize('createdWebApp', 'Successfully created web app "{0}": {1}', context.newSiteName, context.site?.defaultHostName);
    protected getOutputLogFail = (context: IDeployImageWizardContext): string =>
        localize('failedToCreateWebApp', 'Failed to create web app "{0}"', context.newSiteName);
    protected getTreeItemLabel = (context: IDeployImageWizardContext): string =>
        localize('createWebApp', 'Create web app "{0}"', context.newSiteName);

    public async execute(context: IDeployImageWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const message: string = localize('creatingNewApp', 'Creating new web app "{0}"...', context.newSiteName);
        progress.report({ message });

        const siteName: string = nonNullProp(context, 'newSiteName');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');

        const client: WebSiteManagementClient = await createWebSiteClient(context);
        context.site = await client.webApps.beginCreateOrUpdateAndWait(rgName, siteName, await this.getNewSite(context));
        context.activityResult = context.site as AppResource;
    }

    public shouldExecute(context: IDeployImageWizardContext): boolean {
        return !context.site;
    }

    private async getNewSite(context: IDeployImageWizardContext): Promise<Site> {
        const location = await LocationListStep.getLocation(context, webProvider);
        const options = context.deployImageOptions;
        const isArc = !!context.customLocation;
        const isAcrRegistry = !!options.acrResourceId;
        const siteConfig: SiteConfig = {};
        const appSettings: NameValuePair[] = [];

        if (isAcrRegistry && !isArc) {
            // ACR non-Arc: use managed identity, defer linuxFxVersion to after role assignment
            siteConfig.acrUseManagedIdentityCreds = true;
            appSettings.push({ name: 'DOCKER_ENABLE_CI', value: 'true' });
        } else if (isAcrRegistry && isArc) {
            // ACR Arc: fetch admin credentials
            const acrClient: ContainerRegistryManagementClient = await createContainerRegistryClient(context);
            const registryShortName = nonNullProp(options, 'acrResourceName');
            const acrResourceGroup = nonNullProp(options, 'acrResourceGroup');
            const registry = await acrClient.registries.get(acrResourceGroup, registryShortName);
            if (!registry.adminUserEnabled) {
                context.errorHandling.suppressReportIssue = true;
                throw new Error(localize('adminUserDisabled', 'The admin user is not enabled on registry "{0}". Enable it in the Azure Portal under Access keys, then try again.', registryShortName));
            }
            const credentials = await acrClient.registries.listCredentials(
                acrResourceGroup,
                registryShortName,
            );
            const adminUsername = credentials.username ?? '';
            const adminPassword = credentials.passwords?.[0]?.value ?? '';

            appSettings.push(
                { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: adminUsername },
                { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: adminPassword },
                { name: 'DOCKER_REGISTRY_SERVER_URL', value: `https://${options.registryName}` },
            );
            siteConfig.linuxFxVersion = `DOCKER|${options.image}`;
            if (context.containerPort) {
                appSettings.push({ name: 'WEBSITES_PORT', value: context.containerPort });
            }
        } else {
            // Docker Hub / other registries
            appSettings.push(
                { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: options.username ?? '' },
                { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: options.secret ?? '' },
                { name: 'DOCKER_REGISTRY_SERVER_URL', value: `https://${options.registryName}` },
            );
            siteConfig.linuxFxVersion = `DOCKER|${options.image}`;
            if (isArc && context.containerPort) {
                appSettings.push({ name: 'WEBSITES_PORT', value: context.containerPort });
            }
        }

        siteConfig.appSettings = appSettings;

        const site: Site = {
            name: context.newSiteName,
            kind: this.getKind(context),
            location: nonNullProp(location, 'name'),
            serverFarmId: context.plan?.id,
            clientAffinityEnabled: true,
            siteConfig,
            reserved: true, // must be true for Linux
        };

        // Enable System Assigned Managed Identity for ACR non-Arc
        if (isAcrRegistry && !isArc) {
            site.identity = { type: 'SystemAssigned' };
        }

        if (context.customLocation) {
            site.extendedLocation = { name: context.customLocation.id, type: 'customLocation' };
        }

        return site;
    }

    private getKind(context: IDeployImageWizardContext): string {
        let kind = 'app,linux';
        if (context.customLocation) {
            kind += ',kubernetes,container';
        }
        return kind;
    }
}
