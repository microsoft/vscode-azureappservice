/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export interface ITrialAppContext {
    name: string;

    /**
     * When the trial app expires in milliseconds
     */
    expirationDate: number;
    loginSession: string;
}
