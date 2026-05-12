/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { localize } from '../../localize';
import { type IDeployImageWizardContext } from './IDeployImageContext';

export class ContainerPortStep extends AzureWizardPromptStep<IDeployImageWizardContext> {
    public async prompt(context: IDeployImageWizardContext): Promise<void> {
        context.containerPort = await context.ui.showInputBox({
            prompt: localize('containerPort', 'Enter the port that the container listens on'),
            value: '80',
            validateInput: (value: string): string | undefined => {
                const port = parseInt(value, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return localize('invalidPort', 'Please enter a valid port number (1-65535)');
                }
                return undefined;
            },
        });
    }

    public shouldPrompt(context: IDeployImageWizardContext): boolean {
        return !!context.customLocation;
    }
}
