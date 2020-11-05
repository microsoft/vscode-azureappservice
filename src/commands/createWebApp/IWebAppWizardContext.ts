/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAppServiceWizardContext } from 'vscode-azureappservice';
import { ICreateChildImplContext } from 'vscode-azureextensionui';
import { AppStackMajorVersion, AppStackMinorVersion } from './stacks/models/AppStackModel';
import { JavaContainers, WebAppRuntimes, WebAppStack, WebAppStackValue } from './stacks/models/WebAppStackModel';

export type FullWebAppStack = {
    stack: WebAppStack;
    majorVersion: AppStackMajorVersion<WebAppRuntimes>;
    minorVersion: AppStackMinorVersion<WebAppRuntimes>;
};

export type FullJavaStack = {
    stack: WebAppStack;
    majorVersion: AppStackMajorVersion<JavaContainers>;
    minorVersion: AppStackMinorVersion<JavaContainers>;
};

export interface IWebAppWizardContext extends IAppServiceWizardContext, ICreateChildImplContext {
    newSiteRuntime?: string;

    /**
     * The runtimes to put to the top of the QuickPick list to recommend to the user.
     * In the array, Higher ranking means higher priority, thus will have higher position in the QuickPick list.
     */
    recommendedSiteRuntime?: WebAppStackValue[];

    newSiteStack?: FullWebAppStack;
    newSiteJavaStack?: FullJavaStack;
}
