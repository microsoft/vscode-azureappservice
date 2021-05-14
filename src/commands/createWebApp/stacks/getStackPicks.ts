/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../../../localize';
import { getWorkspaceSetting } from '../../../vsCodeConfig/settings';
import { FullJavaStack, FullWebAppStack, IWebAppWizardContext } from '../IWebAppWizardContext';
import { AppStackMinorVersion } from './models/AppStackModel';
import { JavaContainers, WebAppRuntimes, WebAppStack, WebAppStackValue } from './models/WebAppStackModel';

export async function getStackPicks(context: IWebAppWizardContext): Promise<IAzureQuickPickItem<FullWebAppStack>[]>;
export async function getStackPicks(context: IWebAppWizardContext, javaVersion: string): Promise<IAzureQuickPickItem<FullJavaStack>[]>;
export async function getStackPicks(context: IWebAppWizardContext, javaVersion?: string): Promise<IAzureQuickPickItem<FullWebAppStack | FullJavaStack>[]> {
    const stacks: WebAppStack[] = (await getStacks(context)).filter(s => (javaVersion && s.value === 'javacontainers') || (!javaVersion && s.value !== 'javacontainers'));

    const picks: IAzureQuickPickItem<FullWebAppStack | FullJavaStack>[] = [];
    for (const stack of stacks) {
        for (const majorVersion of stack.majorVersions) {
            // Filter out versions that have major, minor, _and_ patch specified (Aka we only want Node.js 14, not Node.js 14.1.1)
            const minorVersions: (AppStackMinorVersion<WebAppRuntimes & JavaContainers>)[] = majorVersion.minorVersions.filter(mv => !/\..*\./.test(mv.value));

            for (const minorVersion of minorVersions) {
                let description: string | undefined;
                const previewOs = getFlagOs(minorVersion.stackSettings, 'isPreview');
                switch (previewOs) {
                    case 'All':
                        description = localize('preview', '(Preview)');
                        break;
                    case 'Linux':
                    case 'Windows':
                        description = localize('previewOnOS', '(Preview on {0})', previewOs);
                        break;
                }

                const earlyAccessOS = getFlagOs(minorVersion.stackSettings, 'isEarlyAccess');
                switch (earlyAccessOS) {
                    case 'All':
                        description = localize('earlyAccess', '(Early Access)');
                        break;
                    case 'Linux':
                    case 'Windows':
                        description = localize('earlyAccessOnOS', '(Early Access on {0})', earlyAccessOS);
                        break;
                }

                picks.push({
                    label: minorVersion.displayText,
                    description,
                    group: stack.displayText,
                    data: { stack, majorVersion, minorVersion }
                });
            }
        }
    }

    return picks;
}

type FlagOS = 'All' | 'Linux' | 'Windows' | 'None';
function getFlagOs(ss: WebAppRuntimes & JavaContainers, key: 'isPreview' | 'isEarlyAccess'): FlagOS {
    if ([ss.linuxContainerSettings, ss.windowsContainerSettings, ss.linuxRuntimeSettings, ss.windowsRuntimeSettings].every(s => !s || s[key])) {
        // NOTE: 'All' means all OS's _that are defined_ have the flag set. This may only be one OS if that's all that is defined/supported by this stack
        return 'All';
    } else if (ss.linuxRuntimeSettings?.[key] || ss.linuxContainerSettings?.[key]) {
        return 'Linux';
    } else if (ss.windowsRuntimeSettings?.[key] || ss.windowsContainerSettings?.[key]) {
        return 'Windows';
    } else {
        return 'None';
    }
}

type StacksArmResponse = { value: { properties: WebAppStack }[] };
async function getStacks(context: IWebAppWizardContext & { _stacks?: WebAppStack[]; }): Promise<WebAppStack[]> {
    if (!context._stacks) {
        const client: ServiceClient = await createGenericClient(context);
        const result: HttpOperationResponse = await client.sendRequest({
            method: 'GET',
            pathTemplate: '/providers/Microsoft.Web/webappstacks',
            queryParameters: {
                'api-version': '2020-10-01',
                removeHiddenStacks: String(!getWorkspaceSetting<boolean>('showHiddenStacks')),
                removeDeprecatedStacks: 'true'
            }
        });
        context._stacks = (<StacksArmResponse>result.parsedBody).value.map(d => d.properties);
    }

    return sortStacks(context, context._stacks);
}

function sortStacks(context: IWebAppWizardContext, stacks: WebAppStack[]): WebAppStack[] {
    const recommendedRuntimes: WebAppStackValue[] = context.recommendedSiteRuntime || [];
    function getPriority(stack: WebAppStack): number {
        const index: number = recommendedRuntimes.findIndex(s => s === stack.value);
        return index === -1 ? recommendedRuntimes.length : index;
    }
    return stacks.sort((s1, s2) => getPriority(s1) - getPriority(s2));
}
