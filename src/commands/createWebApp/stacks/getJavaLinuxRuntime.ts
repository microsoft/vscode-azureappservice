/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../localize';
import { type AppStackMinorVersion } from './models/AppStackModel';
import { type JavaContainers } from './models/WebAppStackModel';

export function getJavaLinuxRuntime(javaMajorVersion: string, containerMinorVersion: AppStackMinorVersion<JavaContainers>): string | undefined {
    switch (javaMajorVersion) {
        case '17':
            return containerMinorVersion.stackSettings.linuxContainerSettings?.java17Runtime;
        case '11':
            return containerMinorVersion.stackSettings.linuxContainerSettings?.java11Runtime;
        case '8':
            return containerMinorVersion.stackSettings.linuxContainerSettings?.java8Runtime;
        default:
            throw new RangeError(localize('invalidJavaVersion', 'Invalid Java version "{0}".', javaMajorVersion));
    }
}
