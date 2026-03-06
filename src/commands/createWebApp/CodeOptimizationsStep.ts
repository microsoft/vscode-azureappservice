/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, type IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import { WebsiteOS } from 'node_modules/@microsoft/vscode-azext-azureappservice/dist/esm/src/createAppService/AppKind';
import { localize } from '../../localize';
import { type IWebAppWizardContext } from './IWebAppWizardContext';

export class CodeOptimizationsStep extends AzureWizardPromptStep<IWebAppWizardContext> {
    public async prompt(context: IWebAppWizardContext): Promise<void> {
        const picks: IAzureQuickPickItem<boolean>[] = [
            { label: localize('yes', 'Yes'), data: true },
            { label: localize('no', 'No'), data: false }
        ];

        const placeHolder: string = localize('enableProfiler', 'Enable Profiler for Code Optimization support?');
        context.enableProfiler = (await context.ui.showQuickPick(picks, { placeHolder, stepName: 'codeOptimizations' })).data;
        context.telemetry.properties.enableProfiler = String(context.enableProfiler);
    }

    public shouldPrompt(context: IWebAppWizardContext): boolean {
        const stack = context.newSiteStack?.stack.value;
        const isDotNet = stack === 'dotnet';
        const isWindows = context.newSiteOS === WebsiteOS.windows;
        const hasAppInsights = !!context.appInsightsComponent || context.advancedCreation !== true; // App Insights is created by default in simple mode

        return isDotNet && isWindows && hasAppInsights && context.enableProfiler === undefined;
    }
}
