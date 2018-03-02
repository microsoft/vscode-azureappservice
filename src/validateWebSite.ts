/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import { RequestOptions } from 'https';
import * as requestP from 'request-promise';
import { URL } from 'url';
import { isNumber } from 'util';
import { OutputChannel } from 'vscode';
import { SiteWrapper } from "vscode-azureappservice";
import { callWithTelemetryAndErrorHandling, IActionContext, parseError } from 'vscode-azureextensionui';
import TelemetryReporter from "vscode-extension-telemetry";
import { SiteTreeItem } from './explorer/SiteTreeItem';

const requestPromise = <(options: RequestOptions | string | URL) => Promise<IncomingMessage>><Function>requestP;

type WebError = {
    response?: {
        statusCode?: number;
        statusMessage?: string;
    }
};

interface IValidateProperties {
    statusCodes?: string; // Comma-delimited
    lastStatusCode?: string;
    lastStatusMessage?: string;
    timedOut?: 'true' | 'false';
}

export async function validateWebSite(siteTreeItem: SiteTreeItem, outputChannel: OutputChannel, telemetryReporter: TelemetryReporter): Promise<void> {
    const siteWrapper = siteTreeItem.siteWrapper;
    return callWithTelemetryAndErrorHandling('appService.validateWebSite', telemetryReporter, outputChannel, async function (this: IActionContext): Promise<void> {
        this.rethrowError = false;
        this.suppressErrorDisplay = true;

        const properties = <IValidateProperties>this.properties;

        let pollingIntervalMs = 1000;
        const pollingIncrementMs = 1000; // Increase in interval each time
        const timeoutTime = Date.now() + 60 * 1000;
        const uri = siteTreeItem.defaultHostUri;
        const options: {} = {
            method: 'GET',
            uri: uri,
            resolveWithFullResponse: true
        };
        let currentStatusCode: number = 0;
        let currentStatusMessage: string = '';

        properties.statusCodes = '';
        properties.timedOut = 'false';

        log(siteWrapper, outputChannel, `Checking for successful response from ${uri}.`);

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            let isSuccess: boolean;
            try {
                const response = <IncomingMessage>(await requestPromise(options));
                // request throws an error for 400-500 responses
                // a status code 200-300 indicates success
                currentStatusCode = response.statusCode;
                isSuccess = response.statusCode >= 200 && response.statusCode < 400;
                currentStatusMessage = response.statusMessage;
            } catch (e) {
                const error = <WebError>e;
                const response = error.response || {};
                isSuccess = false;
                currentStatusCode = isNumber(response.statusCode) ? response.statusCode : 0;
                currentStatusMessage = response.statusMessage || parseError(error).message;
            }

            properties.statusCodes = properties.statusCodes ? `${properties.statusCodes},` : '';
            properties.statusCodes += currentStatusCode;
            properties.lastStatusCode = currentStatusCode.toString();
            properties.lastStatusMessage = currentStatusMessage;

            if (isSuccess) {
                log(siteWrapper, outputChannel, `${uri} returned successful status code ${currentStatusCode}`);
                return;
            }

            if (Date.now() > timeoutTime) {
                properties.timedOut = 'true';
                log(siteWrapper, outputChannel, `Timed out waiting for successful response from ${uri}. Last status code returned: ${currentStatusCode}`);
                throw new Error(currentStatusMessage);
            }

            // tslint:disable-next-line:no-string-based-set-timeout // false positive
            await new Promise<void>((resolve, _reject): void => { setTimeout(resolve, pollingIntervalMs); });
            pollingIntervalMs += pollingIncrementMs;
        }
    });
}

function log(siteWrapper: SiteWrapper, outputChannel: OutputChannel, message: string): void {
    outputChannel.appendLine(`${(new Date()).toLocaleTimeString()} ${siteWrapper.appName}: ${message}`);
}
