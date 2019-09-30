/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { IAppServiceWizardContext } from 'vscode-azureappservice';
import { cpUtils } from '../../utils/cpUtils';

/**
 * Takes any number of Azure config properties to read and returns their configured values.
 * Azure CLI configuration docs: https://aka.ms/AA64syh
 */
export async function readAzConfig(wizardContext: IAppServiceWizardContext, ...propertiesToRead: AzConfigProperties[]): Promise<AzConfig> {
    const config: AzConfig = {};
    const azCommandCheck: cpUtils.ICommandResult = await cpUtils.tryExecuteCommand(undefined, undefined, 'az --version');

    if (azCommandCheck.code === 0) {
        const workspacePath: string | undefined = workspace.workspaceFolders ? workspace.workspaceFolders[0].uri.fsPath : undefined;
        const azGlobalConfigListing = <IAzConfigListing | undefined>JSON.parse(await cpUtils.executeCommand(undefined, undefined, 'az configure --list-defaults --output json'));
        const azLocalConfigListing = <IAzConfigListing | undefined>JSON.parse(await cpUtils.executeCommand(undefined, workspacePath, 'az configure --list-defaults --output json --scope local'));

        readAzConfigListing(wizardContext, propertiesToRead, azGlobalConfigListing, config);

        // Default to local config values if they exist
        readAzConfigListing(wizardContext, propertiesToRead, azLocalConfigListing, config);
    }

    return config;
}

function readAzConfigListing(wizardContext: IAppServiceWizardContext, propertiesToRead: AzConfigProperties[], azConfigListing: IAzConfigListing | undefined, config: AzConfig): void {
    if (azConfigListing) {
        for (const configItem of azConfigListing) {
            for (const propertyToRead of propertiesToRead) {
                if (configItem.name === propertyToRead) {
                    config[propertyToRead] = configItem.value;
                    wizardContext.telemetry.properties[`hasAz${propertyToRead.charAt(0).toUpperCase() + propertyToRead.slice(1)}Default`] = 'true';
                }
            }
        }
    }
}

export type AzConfig = {
    group?: string;
    location?: string;
};

export enum AzConfigProperties {
    group = 'group',
    location = 'location'
}

interface IAzConfigItem {
    name: string;
    source: string;
    value: string;
}

interface IAzConfigListing extends Array<IAzConfigItem> { }
