/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Site } from "azure-arm-website/lib/models";

export interface AzureAppServiceExtensionApi {
    apiVersion: string;
    /**
     * Deploys the project in the given fsPath to the given Site.  The project MUST be opened in VS Code in order to be deployed.
     *
     * @param site The site object: this will be returned by the webApps.createOrUpdate command from the azure-arm-website API
     * @param fsPath The absolute file path of the project to deploy
     */
    deploy(site: Site, fsPath: string): Promise<void>
}
