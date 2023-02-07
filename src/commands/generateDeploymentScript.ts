/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from "@azure/arm-resources";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as fse from 'fs-extra';
import * as path from 'path';
import { ProgressLocation, window, workspace } from "vscode";
import { localize } from "../localize";
import { SiteTreeItem } from "../tree/SiteTreeItem";
import { createResourceClient } from "../utils/azureClients";
import { nonNullValue } from "../utils/nonNull";
import { getResourcesPath } from "../utils/pathUtils";
import { pickWebApp } from "../utils/pickWebApp";

export async function generateDeploymentScript(context: IActionContext, node?: SiteTreeItem): Promise<void> {
    node ??= await pickWebApp(context);

    await window.withProgress({ location: ProgressLocation.Window }, async p => {
        p.report({ message: localize('generatingScript', 'Generating script...') });

        node = nonNullValue(node);

        const resourceClient: ResourceManagementClient = await createResourceClient([context, node.subscription]);
        const client = await node.site.createClient(context);
        const tasks = Promise.all([
            resourceClient.resourceGroups.get(node.site.resourceGroup),
            client.getAppServicePlan(),
            client.getSiteConfig(),
            client.listApplicationSettings()
        ]);

        const taskResults = await tasks;
        const rg = nonNullValue(taskResults[0]);
        const plan = taskResults[1];
        const siteConfig = nonNullValue(taskResults[2]);
        const appSettings = nonNullValue(taskResults[3]);

        let script: string;

        if (!siteConfig.linuxFxVersion) {
            const scriptTemplate = await loadScriptTemplate('windows-default.sh');
            script = scriptTemplate;
        } else if (siteConfig.linuxFxVersion.toLowerCase().startsWith('docker')) {
            const scriptTemplate = await loadScriptTemplate('docker-image.sh');
            let serverUrl: string | undefined;
            let serverUser: string | undefined;
            let serverPwd: string | undefined;
            if (appSettings.properties) {
                serverUrl = appSettings.properties.DOCKER_REGISTRY_SERVER_URL;
                serverUser = appSettings.properties.DOCKER_REGISTRY_SERVER_USERNAME;
                serverPwd = appSettings.properties.DOCKER_REGISTRY_SERVER_PASSWORD;
            }
            const containerParameters =
                (serverUrl ? `SERVERURL="${serverUrl}"\n` : '') +
                (serverUser ? `SERVERUSER="${serverUser}"\n` : '') +
                (serverPwd ? `SERVERPASSWORD="*****"\n` : '');
            const containerCmdParameters =
                (serverUrl ? '--docker-registry-server-url $SERVERURL ' : '') +
                (serverUser ? '--docker-registry-server-user $SERVERUSER ' : '') +
                (serverPwd ? '--docker-registry-server-password $SERVERPASSWORD ' : '');
            script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion)
                .replace('%IMAGENAME%', siteConfig.linuxFxVersion.substring(siteConfig.linuxFxVersion.indexOf('|') + 1))
                .replace('%DOCKER_PARA%', containerParameters)
                .replace('%CTN_CMD_PARA%', containerCmdParameters);
        } else {    // Stock linux image
            const scriptTemplate = await loadScriptTemplate('linux-default.sh');
            script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion);
        }

        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        script = script.replace('%SUBSCRIPTION_NAME%', node.subscription.subscriptionDisplayName)
            .replace('%RG_NAME%', rg.name!)
            .replace('%LOCATION%', rg.location)
            .replace('%PLAN_NAME%', plan!.name!)
            .replace('%PLAN_SKU%', plan!.sku!.name!)
            .replace('%SITE_NAME%', node.site.siteName);
        /* eslint-enable @typescript-eslint/no-non-null-assertion */

        const doc = await workspace.openTextDocument({ language: 'shellscript', content: script });
        await window.showTextDocument(doc);
    });
}

async function loadScriptTemplate(scriptName: string): Promise<string> {
    const templatePath = path.join(getResourcesPath(), 'deploymentScripts', scriptName);
    return await fse.readFile(templatePath, 'utf8');
}
