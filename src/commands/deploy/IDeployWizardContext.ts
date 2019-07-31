/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget } from "vscode";
import { IActionContext } from "vscode-azureextensionui";

export interface IDeployWizardContext extends IActionContext {
    fsPath?: string;
    deployedWithConfigs?: boolean;
    configurationTarget?: ConfigurationTarget;
}
