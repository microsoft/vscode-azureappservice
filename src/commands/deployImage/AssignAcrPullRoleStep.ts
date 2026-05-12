/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type WebSiteManagementClient } from '@azure/arm-appservice';
import { type AuthorizationManagementClient } from '@azure/arm-authorization';
import { type ContainerRegistryManagementClient } from '@azure/arm-containerregistry';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp } from '@microsoft/vscode-azext-utils';
import { type Progress } from 'vscode';
import { localize } from '../../localize';
import { createAuthorizationManagementClient, createContainerRegistryClient, createWebSiteClient } from '../../utils/azureClients';
import { getRandomHexString } from '../../utils/randomUtils';
import { type IDeployImageWizardContext } from './IDeployImageContext';

export class AssignAcrPullRoleStep extends AzureWizardExecuteStepWithActivityOutput<IDeployImageWizardContext> {
    public priority: number = 141;
    public stepName: string = 'assignAcrPullRoleStep';
    protected getOutputLogSuccess = () =>
        localize('assignedAcrPull', 'Successfully assigned AcrPull role and configured image');
    protected getOutputLogFail = () =>
        localize('failedAcrPull', 'Failed to assign AcrPull role');
    protected getTreeItemLabel = () =>
        localize('assignAcrPull', 'Assign AcrPull role');

    public async execute(context: IDeployImageWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const options = context.deployImageOptions;
        const siteName: string = nonNullProp(context, 'newSiteName');
        const rgName: string = nonNullProp(nonNullProp(context, 'resourceGroup'), 'name');
        const registryShortName = options.registryName.split('.')[0];
        const acrResourceGroup = nonNullProp(options, 'acrResourceGroup');
        const acrResourceId = nonNullProp(options, 'acrResourceId');

        progress.report({ message: localize('assigningRole', 'Assigning AcrPull role...') });

        // 1. Get registry details
        const registryClient: ContainerRegistryManagementClient = await createContainerRegistryClient(context);
        await registryClient.registries.get(acrResourceGroup, registryShortName);

        // 2. Look up AcrPull role definition
        const authClient: AuthorizationManagementClient = await createAuthorizationManagementClient(context);
        const roleDefinitions = authClient.roleDefinitions.list(acrResourceId, { filter: "roleName eq 'AcrPull'" });
        let acrPullRoleId: string | undefined;
        for await (const roleDef of roleDefinitions) {
            acrPullRoleId = roleDef.id;
            break;
        }
        if (!acrPullRoleId) {
            throw new Error(localize('acrPullNotFound', 'Could not find AcrPull role definition'));
        }

        // 3. Get managed identity principal ID from the created site
        const webClient: WebSiteManagementClient = await createWebSiteClient(context);
        const site = await webClient.webApps.get(rgName, siteName);
        const principalId = site.identity?.principalId;
        if (!principalId) {
            throw new Error(localize('noPrincipalId', 'Web app does not have a System Assigned Managed Identity'));
        }

        // 4. Create role assignment
        const roleAssignmentName = getRandomHexString(32);
        await authClient.roleAssignments.create(acrResourceId, roleAssignmentName, {
            principalId,
            roleDefinitionId: acrPullRoleId,
            principalType: 'ServicePrincipal',
        });

        // 5. Now set linuxFxVersion (deferred from create step so identity and role are ready)
        progress.report({ message: localize('settingImage', 'Configuring container image...') });
        await webClient.webApps.updateConfiguration(rgName, siteName, {
            linuxFxVersion: `DOCKER|${options.image}`,
        });
    }

    public shouldExecute(context: IDeployImageWizardContext): boolean {
        return !!context.deployImageOptions.acrResourceId && !context.customLocation;
    }
}
