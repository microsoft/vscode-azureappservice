/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from '@vscode/test-cli';
import { azExtTestConfig, baseConfig } from '@microsoft/vscode-azext-eng/vscode-test';

// For local development with Azure sign-in:
// 1. First run: `npm run test:signin` to open VS Code and sign in to Azure
// 2. Then run: `AzCode_EnableLongRunningTestsLocal=true npm test` to run tests with credentials
//
// For CI with Azure DevOps:
// The pipeline sets AzCode_UseAzureFederatedCredentials=true and related env vars
// which enables the Azure Resources extension to use federated credentials

export default azExtTestConfig;
