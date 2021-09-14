/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of 'VS Code'.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {

    //#region Terminal data write event https://github.com/microsoft/vscode/issues/78502

    export interface TerminalDataWriteEvent {
        /**
         * The {@link Terminal} for which the data was written.
         */
        readonly terminal: Terminal;
        /**
         * The data being written.
         */
        readonly data: string;
    }

    namespace window {
        /**
         * An event which fires when the terminal's child pseudo-device is written to (the shell).
         * In other words, this provides access to the raw data stream from the process running
         * within the terminal, including VT sequences.
         */
        export const onDidWriteTerminalData: Event<TerminalDataWriteEvent>;
    }

    //#endregion
}
