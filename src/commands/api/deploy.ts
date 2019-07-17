/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Site } from 'azure-arm-website/lib/models';
import { IAppServiceWizardContext } from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import * as extension from '../deploy';

export async function deploy(site: Site, fsPath: string): Promise<void> {

    await callWithTelemetryAndErrorHandling('api.deploy', async (context: IAppServiceWizardContext) => {
        return await extension.deploy(context, false, site, fsPath);
    });
}
