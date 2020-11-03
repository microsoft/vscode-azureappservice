/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../../../localize';
import { getWorkspaceSetting } from '../../../vsCodeConfig/settings';
import { FullJavaStack, FullWebAppStack, IWebAppWizardContext } from '../IWebAppWizardContext';
import { getJavaLinuxRuntime } from './getJavaLinuxRuntime';
import { AppStackMinorVersion } from './models/AppStackModel';
import { JavaContainers, WebAppRuntimes, WebAppStack, WebAppStackValue } from './models/WebAppStackModel';

export async function getStackPicks(context: IWebAppWizardContext): Promise<IAzureQuickPickItem<FullWebAppStack>[]>;
export async function getStackPicks(context: IWebAppWizardContext, javaVersion: string): Promise<IAzureQuickPickItem<FullJavaStack>[]>;
export async function getStackPicks(context: IWebAppWizardContext, javaVersion?: string): Promise<IAzureQuickPickItem<FullWebAppStack | FullJavaStack>[]> {
    const stacks: WebAppStack[] = await getStacks(context);
    const picks: IAzureQuickPickItem<FullWebAppStack | FullJavaStack>[] = [];
    for (const stack of stacks) {
        for (const majorVersion of stack.majorVersions) {
            const minorVersions: (AppStackMinorVersion<WebAppRuntimes & JavaContainers>)[] = majorVersion.minorVersions
                // Filter out versions that have major, minor, _and_ patch specified (Aka we only want Node.js 14, not Node.js 14.1.1)
                .filter(mv => !/\..*\./.test(mv.value))
                // Filter out versions relative to the specified javaVersion
                .filter(mv => {
                    return (!javaVersion && (mv.stackSettings.linuxRuntimeSettings || mv.stackSettings.windowsRuntimeSettings)) ||
                        (javaVersion && (getJavaLinuxRuntime(javaVersion, mv) || mv.stackSettings.windowsContainerSettings));
                });

            for (const minorVersion of minorVersions) {
                let description: string | undefined;
                if ((!javaVersion && (minorVersion.stackSettings.linuxRuntimeSettings?.isPreview || minorVersion.stackSettings.windowsRuntimeSettings?.isPreview)) ||
                    (javaVersion && (minorVersion.stackSettings.linuxContainerSettings?.isPreview || minorVersion.stackSettings.windowsContainerSettings?.isPreview))) {
                    description = localize('preview', '(Preview)');
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
