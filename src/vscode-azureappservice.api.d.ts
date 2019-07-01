/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export interface AzureAppServiceExtensionApi {
    apiVersion: string;
    /**
     * Creates a web app with the given options.  Empty properties will be their default value or the user will be prompted for it
     *
     * @param subscriptionId The subscription id of an Azure subscription: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     * @param runtime The runtime must be formatted in the following: "NODE|10.14"
     */
    createWebApp(createOptions: {
        subscriptionId?: string,
        siteName?: string,
        rgName?: string,
        websiteOS?: WebsiteOS,
        runtime?: string
    }): Promise<void>
}

export enum WebsiteOS {
    linux = 'linux',
    windows = 'windows'
}
