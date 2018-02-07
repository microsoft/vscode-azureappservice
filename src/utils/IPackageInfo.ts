/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

export let reporter: TelemetryReporter;

export class Reporter extends vscode.Disposable {
    constructor(ctx: vscode.ExtensionContext) {
        //tslint:disable-next-line:promise-function-async
        super(() => reporter.dispose());

        const packageInfo = getPackageInfo(ctx);
        if (packageInfo) {
            reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        }
    }
}

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
