/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { SiteNameStep } from "@microsoft/vscode-azext-azureappservice";
import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { localize } from "../../localize";
import { IWebAppWizardContext } from "./IWebAppWizardContext";
import { setPostPromptDefaults } from "./setPostPromptDefaults";

export class SetPostPromptDefaultsStep extends AzureWizardExecuteStep<IWebAppWizardContext> {
    public priority: number = 80;

    constructor(private readonly siteStep: SiteNameStep) {
        super();
    }

    public async execute(context: IWebAppWizardContext): Promise<void> {
        await setPostPromptDefaults(context, this.siteStep);
        context.newAppInsightsName = await context.relatedNameTask;
        if (!context.newAppInsightsName) {
            throw new Error(localize('uniqueNameError', 'Failed to generate unique name for resources. Use advanced creation to manually enter resource names.'));
        }
    }

    public shouldExecute(context: IWebAppWizardContext): boolean {
        return !context.advancedCreation;
    }
}
