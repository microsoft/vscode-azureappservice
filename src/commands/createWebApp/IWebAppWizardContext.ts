/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAppServiceWizardContext } from 'vscode-azureappservice';
import { LinuxRuntimes } from './LinuxRuntimes';

export interface IWebAppWizardContext extends IAppServiceWizardContext {
    /**
     * The runtime for a new Linux site
     * This will be defined after `WebAppRuntimeStep.prompt` occurs.
     */
    newSiteRuntime?: string;

    /**
     * The runtimes to put to the top of the QuickPick list to recommend to the user.
     * In the array, Higher ranking means higher priority, thus will have higher position in the QuickPick list.
     * This should be set by the extension
     */
    recommendedSiteRuntime?: LinuxRuntimes[];
}
