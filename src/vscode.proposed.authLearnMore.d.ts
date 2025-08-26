/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/microsoft/vscode/issues/168007

	/**
	 * Represents a "Learn More" link or action that can be associated with authentication flows.
	 */
	export interface AuthLearnMoreAction {
		/**
		 * The title or text to display for the learn more action.
		 */
		readonly title: string;

		/**
		 * Optional URI to open when the learn more action is triggered.
		 */
		readonly uri?: Uri;

		/**
		 * Optional command to execute when the learn more action is triggered.
		 */
		readonly command?: Command;

		/**
		 * Optional tooltip text for the learn more action.
		 */
		readonly tooltip?: string;
	}

	/**
	 * Options for customizing authentication-related learn more actions.
	 */
	export interface AuthLearnMoreOptions {
		/**
		 * Learn more actions to display in authentication flows.
		 */
		readonly learnMoreActions?: readonly AuthLearnMoreAction[];

		/**
		 * Whether to show default help/learn more options.
		 */
		readonly showDefaultHelp?: boolean;
	}

	namespace authentication {
		/**
		 * Set global learn more options for authentication flows.
		 * @param options The learn more options to set
		 */
		export function setLearnMoreOptions(options: AuthLearnMoreOptions): void;

		/**
		 * Get the current learn more options for authentication flows.
		 * @returns The current learn more options
		 */
		export function getLearnMoreOptions(): AuthLearnMoreOptions;

		/**
		 * Add a learn more action to the authentication UI.
		 * @param action The learn more action to add
		 * @returns A disposable that removes the action
		 */
		export function addLearnMoreAction(action: AuthLearnMoreAction): Disposable;
	}
}