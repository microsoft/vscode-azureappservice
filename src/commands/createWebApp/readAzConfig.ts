/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

/**
 * Takes any number of Azure config properties and returns their configured values
 * found in `$AZURE_CONFIG_DIR/config`.
 * Azure CLI configuration docs: https://aka.ms/AA64syh
 */
export async function readAzConfig(...properties: AzConfigProperties[]): Promise<AzConfig> {
    const config: AzConfig = {};
    const configPath: string = path.join(os.homedir(), '.azure', 'config');

    if (await fse.pathExists(configPath)) {
        const configStr: string = await fse.readFile(configPath, 'utf-8');
        const defaultsIndex: number = configStr.search('[defaults]');

        if (defaultsIndex !== -1) {
            for (const property of properties) {
                const match: RegExpMatchArray | null = configStr.substring(defaultsIndex).match(RegExp(`${property}[ \\t]?=[ \\t]?(.+)`));

                if (match) {
                    config[property] = match[1].trim();
                }
            }
        }
    }

    return config;
}

export type AzConfig = {
    group?: string;
    plan?: string;
    location?: string;
};

export enum AzConfigProperties {
    group = 'group',
    plan = 'plan',
    location = 'location'
}
