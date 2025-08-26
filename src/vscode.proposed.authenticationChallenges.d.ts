/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/microsoft/vscode/issues/168007

	/**
	 * Represents an authentication challenge that can be presented to the user.
	 */
	export interface AuthenticationChallenge {
		/**
		 * A unique identifier for this challenge.
		 */
		readonly id: string;

		/**
		 * The type of authentication challenge.
		 */
		readonly type: string;

		/**
		 * A human-readable title for the challenge.
		 */
		readonly title: string;

		/**
		 * A detailed description of what the user needs to do.
		 */
		readonly description: string;

		/**
		 * Optional data associated with the challenge.
		 */
		readonly data?: unknown;
	}

	/**
	 * Represents the result of an authentication challenge.
	 */
	export interface AuthenticationChallengeResult {
		/**
		 * Whether the challenge was completed successfully.
		 */
		readonly success: boolean;

		/**
		 * Any data returned from the challenge completion.
		 */
		readonly data?: unknown;

		/**
		 * Error message if the challenge failed.
		 */
		readonly error?: string;
	}

	/**
	 * An authentication provider that can handle authentication challenges.
	 */
	export interface AuthenticationChallengeProvider {
		/**
		 * Handle an authentication challenge.
		 * @param challenge The challenge to handle
		 * @param token A cancellation token
		 * @returns The result of handling the challenge
		 */
		handleChallenge(challenge: AuthenticationChallenge, token: CancellationToken): Thenable<AuthenticationChallengeResult>;
	}

	namespace authentication {
		/**
		 * Register an authentication challenge provider.
		 * @param id The id of the provider
		 * @param provider The provider
		 * @returns A disposable that unregisters the provider
		 */
		export function registerAuthenticationChallengeProvider(id: string, provider: AuthenticationChallengeProvider): Disposable;

		/**
		 * Present an authentication challenge to the user.
		 * @param challenge The challenge to present
		 * @param token A cancellation token
		 * @returns The result of the challenge
		 */
		export function presentChallenge(challenge: AuthenticationChallenge, token?: CancellationToken): Thenable<AuthenticationChallengeResult>;
	}
}