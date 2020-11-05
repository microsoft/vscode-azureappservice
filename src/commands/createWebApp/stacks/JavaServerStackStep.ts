/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setLocationsTask, SiteOSStep, WebsiteOS } from 'vscode-azureappservice';
import { AzureWizardPromptStep, IWizardOptions } from 'vscode-azureextensionui';
import { ext } from '../../../extensionVariables';
import { localize } from '../../../localize';
import { nonNullProp } from '../../../utils/nonNull';
import { IWebAppWizardContext } from '../IWebAppWizardContext';
import { getStackPicks } from './getStackPicks';

export class JavaServerStackStep extends AzureWizardPromptStep<IWebAppWizardContext> {
    public async prompt(context: IWebAppWizardContext): Promise<void> {
        const placeHolder: string = localize('selectJavaServerStack', 'Select a Java web server stack.');
        const javaVersion: string = nonNullProp(context, 'newSiteStack').majorVersion.value;
        context.newSiteJavaStack = (await ext.ui.showQuickPick(getStackPicks(context, javaVersion), { placeHolder })).data;

        if (!context.newSiteJavaStack.minorVersion.stackSettings.linuxContainerSettings) {
            context.newSiteOS = WebsiteOS.windows;
        } else if (!context.newSiteJavaStack.minorVersion.stackSettings.windowsContainerSettings) {
            context.newSiteOS = WebsiteOS.linux;
        }
    }

    public shouldPrompt(wizardContext: IWebAppWizardContext): boolean {
        return !wizardContext.newSiteJavaStack;
    }

    public async getSubWizard(context: IWebAppWizardContext): Promise<IWizardOptions<IWebAppWizardContext> | undefined> {
        if (context.newSiteOS === undefined) {
            return { promptSteps: [new SiteOSStep()] };
        } else {
            await setLocationsTask(context);
            return undefined;
        }
    }
}
