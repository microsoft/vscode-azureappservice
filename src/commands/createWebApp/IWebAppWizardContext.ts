/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IAppServiceWizardContext } from '@microsoft/vscode-azext-azureappservice';
import { type ExecuteActivityContext, type ISubscriptionActionContext } from '@microsoft/vscode-azext-utils';
import { type AppStackMajorVersion, type AppStackMinorVersion } from './stacks/models/AppStackModel';
import { type JavaContainers, type WebAppRuntimes, type WebAppStack, type WebAppStackValue } from './stacks/models/WebAppStackModel';

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

export interface IWebAppWizardContext extends ISubscriptionActionContext, IAppServiceWizardContext, ExecuteActivityContext {
    newSiteRuntime?: string;

    usingBackupStacks?: boolean;

    /**
     * The runtimes to put to the top of the QuickPick list to recommend to the user.
     * In the array, Higher ranking means higher priority, thus will have higher position in the QuickPick list.
     */
    recommendedSiteRuntime?: WebAppStackValue[];

    newSiteStack?: FullWebAppStack;
    newSiteJavaStack?: FullJavaStack;
}
