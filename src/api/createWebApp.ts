/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SkuDescription } from 'azure-arm-website/lib/models';
import { commands } from 'vscode';
import { WebsiteOS } from 'vscode-azureappservice';

export async function createWebApp(createOptions: {
    subscriptionId?: string,
    siteName?: string,
    rgName?: string,
    planName?: string,
    planSku?: SkuDescription,
    websiteOS?: WebsiteOS,
    runtime?: string
}): Promise<void> {

    await commands.executeCommand('appService.CreateWebApp', undefined, createOptions);
}
