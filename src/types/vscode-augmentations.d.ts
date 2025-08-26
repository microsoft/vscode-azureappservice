/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Type augmentations for VS Code API to resolve missing types in dependencies
 */
declare module 'vscode' {
    /**
     * Options for requesting an authentication session.
     * This type appears to be referenced by vscode-azext-utils but doesn't exist in VS Code API.
     * Adding it as a compatible interface based on existing AuthenticationGetSessionOptions.
     */
    export interface AuthenticationSessionRequest {
        readonly scopes: ReadonlyArray<string>;
        readonly account?: AuthenticationSessionAccountInformation;
        readonly silent?: boolean;
        readonly forceNewSession?: boolean | { detail: string };
        readonly clearSessionPreference?: boolean;
        readonly createIfNone?: boolean;
    }
}