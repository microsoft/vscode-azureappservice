/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setLocationsTask, SiteOSStep, WebsiteOS } from '@microsoft/vscode-azext-azureappservice';
import { AzureWizardPromptStep, IWizardOptions } from '@microsoft/vscode-azext-utils';
import { localize } from '../../../localize';
import { IWebAppWizardContext } from '../IWebAppWizardContext';
import { getStackPicks } from './getStackPicks';
import { JavaServerStackStep } from './JavaServerStackStep';

export class WebAppStackStep extends AzureWizardPromptStep<IWebAppWizardContext> {
    public async prompt(context: IWebAppWizardContext): Promise<void> {
        const placeHolder: string = localize('selectRuntimeStack', 'Select a runtime stack.');
        context.newSiteStack = (await context.ui.showQuickPick(getStackPicks(context), { placeHolder, enableGrouping: true })).data;

        if (!context.newSiteStack.minorVersion.stackSettings.linuxRuntimeSettings) {
            context.newSiteOS = WebsiteOS.windows;
        } else if (!context.newSiteStack.minorVersion.stackSettings.windowsRuntimeSettings) {
            context.newSiteOS = WebsiteOS.linux;
        } else if (!context.advancedCreation) {
            context.newSiteOS = <WebsiteOS>context.newSiteStack.stack.preferredOs;
        }
    }

    public shouldPrompt(wizardContext: IWebAppWizardContext): boolean {
        return !wizardContext.newSiteStack;
    }

    public async getSubWizard(context: IWebAppWizardContext): Promise<IWizardOptions<IWebAppWizardContext> | undefined> {
        if (context.newSiteStack?.stack.value === 'java') {
            return { promptSteps: [new JavaServerStackStep()] };
        } else if (context.newSiteOS === undefined) {
            return { promptSteps: [new SiteOSStep()] };
        } else {
            await setLocationsTask(context);
            return undefined;
        }
    }
}
