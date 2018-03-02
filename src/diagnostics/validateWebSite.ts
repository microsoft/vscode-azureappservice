/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteWrapper } from "vscode-azureappservice";
import TelemetryReporter from "vscode-extension-telemetry";
import { OutputChannel, ExtensionContext } from 'vscode';
import { SiteTreeItem } from '../explorer/SiteTreeItem';
import { IncomingMessage } from 'http';
import { AzureActionHandler, parseError } from 'vscode-azureextensionui';
import * as requestP from 'request-promise';

interface IValidateProperties {
    statusCodes?: string; // Comma-delimited
    lastStatusCode?: string;
    lastStatusMessage?: string;
    timedOut?: 'true' | 'false';
}

export async function validateWebSite(context: ExtensionContext, siteTreeItem: SiteTreeItem, outputChannel: OutputChannel, telemetryReporter: TelemetryReporter): Promise<void> {
    let siteWrapper = siteTreeItem.siteWrapper;
    return (new AzureActionHandler(context, outputChannel, telemetryReporter)).callWithTelemetry('appService.validateWebSite', async (properties: IValidateProperties, _measurements) => {
        let pollingIntervalMs = 1000;
        let pollingIncrementMs = 1000; // Increase in interval each time
        let timeoutTime = Date.now() + 60 * 1000;
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

        log(siteWrapper, outputChannel, `Waiting for response from ${uri}.`);

        while (true) {
            let isSuccess: boolean;
            try {
                let response = <IncomingMessage>(await requestP(options));
                // request throws an error for 400-500 responses
                // a status code 200-300 indicates success
                currentStatusCode = response.statusCode;
                isSuccess = response.statusCode >= 200 && response.statusCode < 400;
                currentStatusMessage = response.statusMessage;
            } catch (error) {
                let response = error.response || {};
                isSuccess = false;
                currentStatusCode = response.statusCode || 0;
                currentStatusMessage = response.statusMessage || parseError(error).message;
            }

            properties.statusCodes = properties.statusCodes ? properties.statusCodes + ',' : '';
            properties.statusCodes += currentStatusCode;
            properties.lastStatusCode = currentStatusCode.toString();
            properties.lastStatusMessage = currentStatusMessage;

            if (isSuccess) {
                log(siteWrapper, outputChannel, `${uri} returned successful status code ${currentStatusCode}`);
                return;
            }

            if (Date.now() > timeoutTime) {
                properties.timedOut = 'true';
                log(siteWrapper, outputChannel, `Timed out waiting for response from ${uri}. Last status code returned: ${currentStatusCode}`);
                throw new Error(currentStatusMessage);
            }

            await new Promise((resolve): void => { setTimeout(resolve, pollingIntervalMs); });
            pollingIntervalMs += pollingIncrementMs;
        }
    });
}

function log(siteWrapper: SiteWrapper, outputChannel: OutputChannel, message: string): void {
    outputChannel.appendLine(`${(new Date()).toLocaleTimeString()} ${siteWrapper.appName}: ${message}`);
}
