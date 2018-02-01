/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export interface IPackageInfo {
    name: string;
    version: string;
    aiKey: string;
}

export function getPackageInfo(context: vscode.ExtensionContext): IPackageInfo | undefined {
    // tslint:disable-next-line:non-literal-require
    const extensionPackage: IPackageInfo = <IPackageInfo>require(context.asAbsolutePath('./package.json')); // context.asAbsolutePath here is trusted
    if (extensionPackage) {
        return {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey
        };
    }
    return undefined;
}
