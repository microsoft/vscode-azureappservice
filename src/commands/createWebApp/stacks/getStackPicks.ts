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
                if (isFlagSet(minorVersion.stackSettings, 'isPreview')) {
                    description = localize('preview', '(Preview)');
                } else if (isFlagSet(minorVersion.stackSettings, 'isEarlyAccess')) {
                    description = localize('earlyAccess', '(Early Access)');
                }

                picks.push({
                    label: minorVersion.displayText,
                    description,
                    data: { stack, majorVersion, minorVersion }
                });
            }
        }
    }

    return picks;
}

function isFlagSet(ss: WebAppRuntimes & JavaContainers, key: 'isPreview' | 'isEarlyAccess'): boolean {
    return !![ss.linuxContainerSettings, ss.windowsContainerSettings, ss.linuxRuntimeSettings, ss.windowsRuntimeSettings].find(s => s && s[key]);
}

async function getStacks(context: IWebAppWizardContext & { _stacks?: WebAppStack[]; }): Promise<WebAppStack[]> {
    if (!context._stacks) {
        const client: ServiceClient = await createGenericClient();
        const result: HttpOperationResponse = await client.sendRequest({
            method: 'GET',
            url: 'https://aka.ms/AAa5gfo',
            queryParameters: {
                'api-version': '2020-10-01',
                removeHiddenStacks: String(!getWorkspaceSetting<boolean>('showHiddenStacks')),
                removeDeprecatedStacks: 'true'
            }
        });
        context._stacks = <WebAppStack[]>result.parsedBody;
    }

    return sortStacks(context, context._stacks);
}

function sortStacks(context: IWebAppWizardContext, stacks: WebAppStack[]): WebAppStack[] {
    // tslint:disable-next-line: strict-boolean-expressions
    const recommendedRuntimes: WebAppStackValue[] = context.recommendedSiteRuntime || [];
    function getPriority(stack: WebAppStack): number {
        const index: number = recommendedRuntimes.findIndex(s => s === stack.value);
        return index === -1 ? recommendedRuntimes.length : index;
    }
    return stacks.sort((s1, s2) => getPriority(s1) - getPriority(s2));
}
