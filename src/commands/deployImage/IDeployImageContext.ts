/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IAppServiceWizardContext } from '@microsoft/vscode-azext-azureappservice';
import { type ExecuteActivityContext, type ISubscriptionActionContext } from '@microsoft/vscode-azext-utils';

/** This is the contract shared with the Container Tools extension */
export interface DeployImageToAppServiceOptionsContract {
    image: string;
    registryName: string;
    username?: string;
    secret?: string;
    acrResourceGroup?: string;
    acrResourceId?: string;
    acrResourceName?: string;
}

export interface IDeployImageWizardContext extends ISubscriptionActionContext, IAppServiceWizardContext, ExecuteActivityContext {
    deployImageOptions: DeployImageToAppServiceOptionsContract;
    containerPort?: string;
}
