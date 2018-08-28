/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TelemetryProperties } from "vscode-azureextensionui";
import { runtimes } from "../constants";
import * as util from '../util';

// tslint:disable-next-line:export-name
export function isJavaRuntime(runtime: string | undefined): boolean {
    if (runtime) {
        const lowerCaseRuntime: string = runtime.toLowerCase();
        return lowerCaseRuntime.startsWith(runtimes.tomcat) ||
            lowerCaseRuntime === runtimes.javase;
    }
    return false;
}

export async function getJavaRuntimeTargetFile(runtime: string | undefined, telemetryProperties: TelemetryProperties): Promise<string> {
    let fileExtension: string;
    if (runtime && runtime.toLowerCase() === runtimes.javase) {
        fileExtension = 'jar';
    } else if (runtime && runtime.toLowerCase().startsWith(runtimes.tomcat)) {
        fileExtension = 'war';
    } else {
        throw new Error(`Invalid java runtime: ${runtime}`);
    }
    return util.showQuickPickByFileExtension(telemetryProperties, `Select the ${fileExtension} file to deploy...`, fileExtension);
}
