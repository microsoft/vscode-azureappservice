/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export function createRequestUrl(base: string, queryParams: Record<string, string>): string {
    const queryString = new URLSearchParams(queryParams).toString();
    return `${base}?${queryString}`;
}
