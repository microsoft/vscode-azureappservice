/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Type patch for missing AuthenticationSessionRequest in VS Code API
 * This appears to be an internal type that should not be exposed publicly
 */
declare module 'vscode' {
    export interface AuthenticationSessionRequest {
        scopes: readonly string[];
        options?: {
            createIfNone?: boolean;
            clearSessionPreference?: boolean;
            silent?: boolean;
        };
    }
}