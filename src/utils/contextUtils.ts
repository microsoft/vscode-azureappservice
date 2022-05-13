/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export function matchContextValue(contextValue: RegExp | string, expectedValues: (string | RegExp)[]): boolean {
    if (contextValue instanceof RegExp) {
        return expectedValues.some((expectedValue) => {
            if (expectedValue instanceof RegExp) {
                return contextValue.toString() === expectedValue.toString();
            }
            return contextValue.test(expectedValue);
        });
    } else {
        return expectedValues.some((expectedValue) => {
            if (expectedValue instanceof RegExp) {
                return expectedValue.test(contextValue);
            }
            return contextValue === expectedValue;
        });
    }
}
