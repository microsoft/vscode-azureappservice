/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IAppServiceWizardContext, WebsiteOS } from 'vscode-azureappservice';
import { callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import * as extension from '../createWebApp/createWebApp';

export async function createWebApp(createOptions: {
    subscriptionId?: string,
    siteName?: string,
    rgName?: string,
    runtime?: string
}): Promise<void> {

    await callWithTelemetryAndErrorHandling('api.CreateWebApp', async (context: IAppServiceWizardContext) => {
        // the team requesting for the api only wants to create Linux apps
        context.newSiteOS = WebsiteOS.linux;
        return await extension.createWebApp(context, undefined, createOptions);
    });
}
