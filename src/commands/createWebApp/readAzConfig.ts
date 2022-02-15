/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WorkspaceFolder } from 'vscode';
import { IDeployContext } from '@microsoft/vscode-azext-azureappservice';
import { cpUtils } from '../../utils/cpUtils';
import { getSingleRootWorkspace } from '../../utils/workspace';
import { IWebAppWizardContext } from './IWebAppWizardContext';

/**
 * Takes any number of Azure config properties to read and returns their configured values.
 * Azure CLI configuration docs: https://aka.ms/AA64syh
 */
export async function readAzConfig(wizardContext: IWebAppWizardContext & Partial<IDeployContext>, ...propertiesToRead: AzConfigProperty[]): Promise<AzConfig> {
    const config: AzConfig = {};
    const workspaceFolder: WorkspaceFolder | undefined = getSingleRootWorkspace(wizardContext);
    const workspacePath: string | undefined = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

    try {
        const azGlobalConfigListing: IAzConfigItem[] | undefined = <IAzConfigItem[] | undefined>JSON.parse(await cpUtils.executeCommand(undefined, undefined, 'az configure --list-defaults --output json'));
        const azLocalConfigListing: IAzConfigItem[] | undefined = <IAzConfigItem[] | undefined>JSON.parse(await cpUtils.executeCommand(undefined, workspacePath, 'az configure --list-defaults --output json --scope local'));

        readAzConfigListing(wizardContext, propertiesToRead, azGlobalConfigListing, config);

        // Default to local config values if they exist
        readAzConfigListing(wizardContext, propertiesToRead, azLocalConfigListing, config);
    } catch (error) {
        // Suppress errors - this functionality should not block creating a web app
    }

    return config;
}

function readAzConfigListing(wizardContext: IWebAppWizardContext, propertiesToRead: AzConfigProperty[], azConfigListing: IAzConfigItem[] | undefined, config: AzConfig): void {
    if (azConfigListing) {
        for (const configItem of azConfigListing) {
            for (const propertyToRead of propertiesToRead) {
                if (configItem.name === propertyToRead) {
                    config[propertyToRead] = configItem.value;
                    wizardContext.telemetry.properties[`hasAz${propertyToRead}Default`] = 'true';
                }
            }
        }
    }
}

export enum AzConfigProperty {
    group = 'group',
    location = 'location'
}

export type AzConfig = {
    [key in AzConfigProperty]?: string;
};

interface IAzConfigItem {
    name: string;
    source: string;
    value: string;
}
